<script
	lang="ts"
	module
>
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);
</script>

<script lang="ts">
	import { halftone } from "./tsl";

	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { loadAbalone } from "@functions/loadAbalone";
	import { setCameraAspect } from "@functions/setCameraAspect";
	import { setDRACOLoader } from "@functions/setDRACOLoader";

	import * as t from "three/webgpu";
	import {
		GLTFLoader,
		OrbitControls,
		RoomEnvironment,
	} from "three/examples/jsm/Addons.js";
	import {
		PI,
		mix,
		pass,
		pmremTexture,
		screenUV,
		step,
		texture,
		uniform,
	} from "three/tsl";

	const scene = new t.Scene();
	const background = {
		value: "#a37287",
	};
	const backgroundColor = new t.Color(background.value);
	scene.background = backgroundColor;

	const camera = new t.PerspectiveCamera();

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	$effect(() => {
		loadAbalone(gltfLoader).then((gltf) => {
			fitCameraToObject(camera, gltf.scene);
			scene.add(gltf.scene);
		});
	});

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;
	orbit.autoRotateSpeed = 1;

	const size = uniform(8);
	const spacing = uniform(0.5);

	const enabled = uniform(true);

	const degrees = uniform(new t.Vector4(15, 45, 0, 75));
	const strengths = uniform(new t.Vector4(0.7, 1, 1, 0.5));

	const colorLabelsAndKeys = [
		["cyan", "x"],
		["magenta", "y"],
		["yellow", "z"],
		["black", "w"],
	] as const;

	const angles = degrees.mul(PI).div(180);

	const canvasSize = new Size();

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach (container) => {
			const pane = new Pane({
				container,
				title: "controls",
			});

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
		}}
	/>
	<canvas
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new t.WebGPURenderer({
				antialias: true,
				canvas,
			});

			$effect(() => {
				renderer.setSize(rendererSize.width, rendererSize.height, false);
			});

			const renderPipeline = new t.RenderPipeline(renderer);
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

			const setAnimationLoop = renderer.setAnimationLoop(() => {
				if (orbit.autoRotate) orbit.update();

				renderPipeline.render();
			});

			const envMapPromise = setAnimationLoop.then(() => {
				const pmremGenerator = new t.PMREMGenerator(renderer);
				const environment = new RoomEnvironment();
				const envMap = pmremTexture(
					pmremGenerator.fromScene(environment).texture,
				);
				pmremGenerator.dispose();
				environment.dispose();
				const lastEnvironment = scene.environment;
				scene.environmentNode = envMap;
				return () => {
					scene.environment = lastEnvironment;
				};
			});

			return () => {
				renderPipeline.dispose();
				envMapPromise.then((cleanup) => {
					cleanup();
				});
				setAnimationLoop.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
