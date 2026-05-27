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

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { loadAbalone } from "@functions/loadAbalone";
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
		WebGPURenderer,
	} from "three/webgpu";

	// const chars =" %@";
	const chars = " .:-=+*#%@";
	// const chars = " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

	const charSize = 32;
	const charsCount = chars.length;

	const osc = new OffscreenCanvas(charSize * charsCount, charSize);
	const context = osc.getContext("2d");
	if (context === null) throw new Error("canvas context is null");

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

	const scene = new Scene();

	loadAbalone(gltfLoader).then((gltf) => {
		scene.add(gltf.scene);
	});

	hdrLoader.loadAsync(hdrUrl).then((hdr) => {
		hdr.mapping = EquirectangularReflectionMapping;
		const texture = pmremTexture(hdr);
		scene.environmentNode = scene.backgroundNode = texture;
	});

	const camera = new PerspectiveCamera().translateZ(0.25);
	const orbit = new OrbitControls(camera);
	// orbit.autoRotate = true;

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	const glyphSize = uniform(16);

	const charsTex = createDisposed(CanvasTexture, osc);
	charsTex.flipY = false;
	charsTex.generateMipmaps = false;
</script>

<canvas
	width={osc.width}
	height={osc.height}
	{@attach (canvas) => {
		const context = canvas.getContext("2d");
		context?.drawImage(osc, 0, 0);
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

			charsTex.colorSpace = renderer.currentColorSpace;

			const renderPipeline = new RenderPipeline(renderer);
			renderPipeline.outputNode = mix(
				ascii(tex, charsTex, charsCount, {
					glyphSize,
				}),
				texture(tex),
				step(0.5, screenUV.x),
			);
			const promise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

				orbit.update();
				renderPipeline.render();
			});

			return () => {
				renderPipeline.dispose();
				promise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
