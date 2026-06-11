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

	import { RendererSize, setRendererSize } from "@classes/RendererSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { loadAbalone } from "@functions/loadAbalone";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
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

	const scene = new t.Scene();

	const setEnvironment = hdrLoader.loadAsync(hdrUrl).then((hdr) => {
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

	loadAbalone(gltfLoader).then((gltf) => {
		fitCameraToObject(camera, gltf.scene);
		scene.add(gltf.scene);
	});

	const camera = new t.PerspectiveCamera();

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	const uSize = uniform(3);

	const canvasSize = new Size();
	const rendererSize = RendererSize.fromSize(canvasSize);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});
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
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new t.WebGPURenderer({
				antialias: true,
				canvas,
			});

			$effect(() => {
				setRendererSize(renderer, rendererSize);
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
