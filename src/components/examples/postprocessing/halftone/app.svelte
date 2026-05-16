<script
	lang="ts"
	module
>
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { loadAbalone } from "@functions/loadAbalone";

	const gltfLoader = new GLTFLoader();
</script>

<script lang="ts">
	import { halftone } from "./tsl";

	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import {
		GLTFLoader,
		OrbitControls,
		RoomEnvironment,
	} from "three/examples/jsm/Addons.js";
	import { pass, select, texture, uniform } from "three/tsl";
	import {
		PMREMGenerator,
		PerspectiveCamera,
		RenderPipeline,
		Scene,
		WebGPURenderer,
	} from "three/webgpu";

	const scene = new Scene();
	const camera = new PerspectiveCamera().translateZ(0.25);

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	loadAbalone(gltfLoader).then((gltf) => {
		scene.add(gltf.scene);
	});

	const environment = createDisposed(RoomEnvironment);

	const orbit = new OrbitControls(camera);

	const radius = uniform(0.5);
	const size = uniform(16);
	const enabled = uniform(true);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "uniforms",
			},
			(pane) => {
				pane.addBinding(size, "value", {
					label: "size",
					options: {
						"4": 4,
						"8": 8,
						"16": 16,
						"32": 32,
					},
				});

				pane.addBinding(radius, "value", {
					label: "radius",
					min: 0,
					max: 0.5,
					step: 0.1,
				});

				pane.addBinding(enabled, "value", {
					label: "enabled",
				});
			},
		)}
	/>
	<canvas
		class="aspect-square md:md:aspect-video"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				antialias: true,
				canvas,
			});

			const renderPipeline = new RenderPipeline(renderer);
			renderPipeline.outputNode = select(
				enabled,
				halftone(tex, {
					radius,
					size,
				}),
				texture(tex),
			);

			const pmremGenerator = new PMREMGenerator(renderer);

			const promise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

				renderPipeline.render();
			});

			promise.then(() => {
				const envMap = pmremGenerator.fromScene(environment).texture;
				scene.environment = envMap;
			});

			return () => {
				renderPipeline.dispose();
				pmremGenerator.dispose();
				promise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
