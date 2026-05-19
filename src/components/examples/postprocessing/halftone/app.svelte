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
	import { PI, pass, select, texture, uniform } from "three/tsl";
	import {
		Color,
		PMREMGenerator,
		PerspectiveCamera,
		RenderPipeline,
		Scene,
		Vector4,
		WebGPURenderer,
	} from "three/webgpu";

	const scene = new Scene();
	scene.background = new Color("#00aaaa");
	const camera = new PerspectiveCamera().translateZ(0.25);

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	loadAbalone(gltfLoader).then((gltf) => {
		scene.add(gltf.scene);
	});

	const environment = createDisposed(RoomEnvironment);

	const orbit = new OrbitControls(camera);
	orbit.autoRotateSpeed = 1;

	const size = uniform(8);
	const spacing = uniform(0.5);

	const enabled = uniform(true);

	const degrees = uniform(new Vector4(15, 45, 0, 75));
	const strengths = uniform(new Vector4(0.7, 1, 1, 0.5));

	const colorLabelsAndKeys = [
		["cyan", "x"],
		["magenta", "y"],
		["yellow", "z"],
		["black", "w"],
	] as const;

	const angles = degrees.mul(PI).div(180);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "controls",
			},
			(pane) => {
				pane.addBinding(orbit, "autoRotate", {
					label: "rotate camera",
				});

				const uniformsFolder = pane.addFolder({ title: "uniforms" });

				uniformsFolder.addBinding(enabled, "value", {
					label: "enabled",
				});

				uniformsFolder.addBinding(size, "value", {
					label: "size",
					options: {
						"4": 4,
						"8": 8,
						"16": 16,
						"32": 32,
					},
				});

				uniformsFolder.addBinding(spacing, "value", {
					label: "spacing",
					max: 0.5,
					min: 0.1,
					step: 0.1,
				});

				const strengthsFolder = uniformsFolder.addFolder({
					title: "strengths",
				});

				for (const [label, key] of colorLabelsAndKeys) {
					strengthsFolder.addBinding(strengths.value, key, {
						min: 0,
						max: 1,
						step: 0.1,
						label,
					});
				}

				const degreesFolder = uniformsFolder.addFolder({
					title: "degrees",
				});

				for (const [label, key] of colorLabelsAndKeys) {
					degreesFolder.addBinding(degrees.value, key, {
						min: 0,
						max: 90,
						step: 1,
						label,
					});
				}
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
					angles,
					size,
					strengths,
					spacing,
				}),
				texture(tex),
			);

			const pmremGenerator = new PMREMGenerator(renderer);

			const promise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

				if (orbit.autoRotate) orbit.update();

				renderPipeline.render();
			});

			const pmremPromise = promise.then(() => {
				const envMap = pmremGenerator.fromScene(environment).texture;
				const last = scene.environment;
				scene.environment = envMap;
				return () => {
					scene.environment = last;
				};
			});

			return () => {
				renderPipeline.dispose();
				pmremPromise.then((cleanup) => {
					cleanup();
					pmremGenerator.dispose();
				});
				promise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
