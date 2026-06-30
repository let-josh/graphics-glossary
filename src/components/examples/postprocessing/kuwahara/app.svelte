<script
	lang="ts"
	module
>
	const hdrLoader = new HDRLoader();
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);
</script>

<script lang="ts">
	import { kuwahara } from "./tsl";

	import hdrUrl from "@assets/hdrs/suburban_garden_1k.hdr";

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

	const { promise: loadEnvironment, resolve: resolveEnvironment } =
		Promise.withResolvers<t.DataTexture>();

	$effect(() => {
		hdrLoader.loadAsync(hdrUrl).then(resolveEnvironment);
		loadAbalone(gltfLoader).then((gltf) => {
			fitCameraToObject(camera, gltf.scene);
			scene.add(gltf.scene);
		});
	});

	const setEnvironment = loadEnvironment.then((hdr) => {
		const lastBackground = scene.backgroundNode;
		const lastEnvironment = scene.environmentNode;

		const environment = pmremTexture(hdr);
		scene.backgroundNode = scene.environmentNode = environment.rgb;
		return () => {
			scene.backgroundNode = lastBackground;
			scene.environmentNode = lastEnvironment;
			environment.value.dispose();
		};
	});

	onCleanup(() => {
		setEnvironment.then((cleanup) => {
			cleanup();
		});
	});

	const camera = new t.PerspectiveCamera();

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	const uSize = uniform(3);

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});
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

			const uniformsFolder = pane.addFolder({
				title: "uniforms",
			});

			uniformsFolder.addBinding(uSize, "value", {
				min: 1,
				max: 5,
				step: 1,
				label: "size",
			});

			return () => {
				pane.dispose();
			};
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
				kuwahara(tex, { size: uSize.toInt() }),
				texture(tex),
				step(0.5, screenUV.x),
			);

			const setAnimationLoop = renderer.setAnimationLoop(() => {
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
