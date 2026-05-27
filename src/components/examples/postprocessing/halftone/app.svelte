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
	import { PI, mix, pass, screenUV, step, texture, uniform } from "three/tsl";
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
	const background = {
		value: "#a37287",
	};
	const backgroundColor = new Color(background.value);
	scene.background = backgroundColor;

	const camera = new PerspectiveCamera().translateZ(0.25);

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	loadAbalone(gltfLoader).then((gltf) => {
		scene.add(gltf.scene);
	});

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;
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
					label: "rotate",
				});
				pane
					.addBinding(background, "value", {
						label: "background",
					})
					.on("change", (e) => {
						if (!e.last) backgroundColor.setStyle(e.value);
					});

				const uniformsFolder = pane.addFolder({
					expanded: false,
					title: "uniforms",
				});

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

				for (const [title, key] of colorLabelsAndKeys) {
					const folder = uniformsFolder.addFolder({
						title,
					});

					folder.addBinding(strengths.value, key, {
						label: "strength",
						min: 0,
						max: 1,
						step: 0.1,
					});

					folder.addBinding(degrees.value, key, {
						label: "degrees",
						min: 0,
						max: 90,
						step: 1,
					});
				}
			},
		)}
	/>
	<canvas
		class="aspect-square md:aspect-video"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				antialias: true,
				canvas,
			});

			const renderPipeline = new RenderPipeline(renderer);
			renderPipeline.outputNode = mix(
				halftone(tex, {
					angles,
					size,
					strengths,
					spacing,
				}),
				texture(tex),
				step(0.5, screenUV.x),
			);

			const promise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

				if (orbit.autoRotate) orbit.update();

				renderPipeline.render();
			});

			const envMapPromise = promise.then(() => {
				const pmremGenerator = new PMREMGenerator(renderer);
				const environment = new RoomEnvironment();
				const envMap = pmremGenerator.fromScene(environment).texture;
				pmremGenerator.dispose();
				environment.dispose();
				const lastEnvironment = scene.environment;
				scene.environment = envMap;
				return () => {
					scene.environment = lastEnvironment;
				};
			});

			return () => {
				renderPipeline.dispose();
				envMapPromise.then((cleanup) => {
					cleanup();
				});
				promise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
