<script
	lang="ts"
	module
>
	import hdrUrl from "@assets/hdrs/suburban_garden_1k.hdr";

	const hdrLoader = new HDRLoader();
	const gltfLoader = new GLTFLoader();
</script>

<script lang="ts">
	import { kuwahara } from "./tsl";

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
	import { mix, pass, screenUV, step, texture, uniform } from "three/tsl";
	import {
		EquirectangularReflectionMapping,
		PerspectiveCamera,
		RenderPipeline,
		Scene,
		WebGPURenderer,
	} from "three/webgpu";

	const scene = new Scene();
	const camera = new PerspectiveCamera();

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const cleanupHdr = hdrLoader.loadAsync(hdrUrl).then((hdr) => {
		hdr.mapping = EquirectangularReflectionMapping;
		const lastBackground = scene.background;
		const lastEnvironment = scene.environment;
		scene.background = scene.environment = hdr;
		return () => {
			scene.background = lastBackground;
			scene.environment = lastEnvironment;
			hdr.dispose();
		};
	});

	onCleanup(() => {
		cleanupHdr.then((cleanup) => {
			cleanup();
		});
	});

	loadAbalone(gltfLoader).then((gltf) => {
		fitCameraToObject(camera, gltf.scene);
		scene.add(gltf.scene);
	});

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	const uSize = uniform(3);
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

				const uniformsFolder = pane.addFolder({
					title: "uniforms",
				});

				uniformsFolder.addBinding(uSize, "value", {
					min: 1,
					max: 5,
					step: 1,
					label: "size",
				});
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
				kuwahara(tex, { size: uSize.toInt() }),
				texture(tex),
				step(0.5, screenUV.x),
			);

			const setAnimationLoop = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

				if (orbit.autoRotate) orbit.update();

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
