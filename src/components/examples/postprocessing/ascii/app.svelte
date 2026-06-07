<script
	module
	lang="ts"
>
	const gltfLoader = new GLTFLoader();
	const hdrLoader = new HDRLoader();
</script>

<script lang="ts">
	import { ascii } from "./tsl";

	import hdrUrl from "@assets/hdrs/glasshouse_interior_1k.hdr";

	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { loadAbalone } from "@functions/loadAbalone";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import {
		GLTFLoader,
		HDRLoader,
		OrbitControls,
	} from "three/examples/jsm/Addons.js";
	import {
		mix,
		pass,
		pmremTexture,
		screenUV,
		step,
		texture,
		uniform,
	} from "three/tsl";
	import {
		CanvasTexture,
		EquirectangularReflectionMapping,
		PerspectiveCamera,
		RenderPipeline,
		Scene,
		Texture,
		WebGPURenderer,
	} from "three/webgpu";

	// const chars = " %@";
	const chars = " .:-=+*#%@";
	// const chars = " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
	const charsCount = chars.length;

	const charSize = 32;

	const scene = new Scene();

	const camera = new PerspectiveCamera();
	loadAbalone(gltfLoader).then((gltf) => {
		fitCameraToObject(camera, gltf.scene);
		scene.add(gltf.scene);
	});

	hdrLoader.loadAsync(hdrUrl).then((hdr) => {
		hdr.mapping = EquirectangularReflectionMapping;
		scene.environmentNode = scene.backgroundNode = pmremTexture(hdr);
	});

	const orbit = new OrbitControls(camera);

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	const glyphSize = uniform(16);

	const charsTex = texture(new Texture());

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
			const char = chars[i];
			const x = y + charSize * i;
			context.fillText(char, x, y);
		}

		const last = charsTex.value;
		const tex = new CanvasTexture(canvas);
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
		{@attach pane(
			{
				title: "uniforms",
			},
			(pane) => {
				pane.addBinding(glyphSize, "value", {
					label: "glyph size",
					options: {
						"8": 8,
						"16": 16,
						"32": 32,
					},
				});
			},
		)}
	/>
	<canvas
		class="aspect-square md:aspect-video"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				canvas,
			});

			const renderPipeline = new RenderPipeline(renderer);
			renderPipeline.outputNode = mix(
				ascii(tex, charsTex, charsCount, {
					glyphSize,
				}),
				texture(tex),
				step(0.5, screenUV.x),
			);
			const setAnimationLoop = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

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
