<script
	module
	lang="ts"
>
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);
	const hdrLoader = new HDRLoader();

	// const chars = " %@";
	const chars = " .:-=+*#%@";
	// const chars = " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
	const charsCount = chars.length;

	const charSize = 32;
</script>

<script lang="ts">
	import { ascii } from "./tsl";

	import hdrUrl from "@assets/hdrs/glasshouse_interior_1k.hdr";

	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { loadAbalone } from "@functions/loadAbalone";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";
	import { setDRACOLoader } from "@functions/setDRACOLoader";

	import * as t from "three/webgpu";
	import { GLTFLoader, HDRLoader, OrbitControls } from "three/addons";
	import {
		mix,
		pass,
		pmremTexture,
		screenUV,
		step,
		texture,
		uniform,
	} from "three/tsl";
	import { Pane } from "tweakpane";

	const scene = new t.Scene();

	const camera = new t.PerspectiveCamera();

	const { promise: loadHDR, resolve: resolveHDR } =
		Promise.withResolvers<t.Texture>();

	$effect(() => {
		hdrLoader.loadAsync(hdrUrl).then(resolveHDR);
		loadAbalone(gltfLoader).then((gltf) => {
			fitCameraToObject(camera, gltf.scene);
			scene.add(gltf.scene);
		});
	});

	const createPMREMNode = loadHDR.then((hdr) => pmremTexture(hdr));

	const setBackground = createPMREMNode.then((environment) => {
		const lastEnvironment = scene.environmentNode;
		const lastBackground = scene.backgroundNode;
		scene.environmentNode = scene.backgroundNode = environment;
		return () => {
			scene.environmentNode = lastEnvironment;
			scene.backgroundNode = lastBackground;
		};
	});

	onCleanup(() => {
		setBackground.then((cleanup) => {
			cleanup();
		});
		createPMREMNode.then((node) => {
			node.dispose();
		});
	});

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();
	const glyphSizes = {
		"8": 8,
		"16": 16,
		"32": 32,
	} as const;
	const glyphSize = uniform(glyphSizes[16]);

	const charsTex = texture();

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	onCleanup(() => {
		charsTex.dispose();
	});
</script>

<canvas
	width={charSize * charsCount}
	height={charSize}
	{@attach (canvas) => {
		const context = canvas.getContext("2d");
		if (context === null) return;

		context.font = `${charSize}px monospace`;
		context.textBaseline = "middle";
		context.textAlign = "center";

		context.fillStyle = "white";
		const y = 0.5 * charSize;
		for (let i = 0; i < charsCount; i += 1) {
			const char = chars[i] ?? "";
			const x = y + charSize * i;
			context.fillText(char, x, y);
		}

		const last = charsTex.value;
		const tex = new t.CanvasTexture(canvas);
		tex.flipY = false;
		tex.generateMipmaps = false;
		charsTex.value = tex;
		return () => {
			charsTex.value = last;
			tex.dispose();
		};
	}}
>
</canvas>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach (container) => {
			const pane = new Pane({
				container,
				expanded: false,
				title: "controls",
			});

			pane.addBinding(orbit, "autoRotate", {
				label: "rotate",
			});
			const uniformsFolder = pane.addFolder({ title: "uniforms" });
			uniformsFolder.addBinding(glyphSize, "value", {
				label: "glyph size",
				options: glyphSizes,
			});
		}}
	/>
	<canvas
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new t.WebGPURenderer({
				canvas,
			});

			$effect(() => {
				renderer.setSize(rendererSize.width, rendererSize.height, false);
			});

			const renderPipeline = new t.RenderPipeline(renderer);
			renderPipeline.outputNode = mix(
				ascii(tex, charsTex, charsCount, {
					glyphSize,
				}),
				texture(tex),
				step(0.5, screenUV.x),
			);

			const setAnimationLoop = renderer.setAnimationLoop(() => {
				const aspect = canvas.clientWidth / canvas.clientHeight;
				setCameraAspect(camera, aspect);

				orbit.update();
				renderPipeline.render();
			});

			return () => {
				renderPipeline.dispose();
				setAnimationLoop.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
