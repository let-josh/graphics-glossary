<script
	module
	lang="ts"
>
	const audioLoader = new t.AudioLoader();
	const FFT_SIZE = 256;
</script>

<script lang="ts">
	import { createOutline } from "./createOutline";

	import audioUrl from "@assets/audio/Stadium-Rave-A.ogg";

	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import { Pane } from "tweakpane";

	const camera = new t.PerspectiveCamera().translateZ(7);

	const { promise, resolve } = Promise.withResolvers<AudioBuffer>();

	$effect(() => {
		audioLoader.loadAsync(audioUrl).then(resolve);
	});

	const createAudio = promise.then((buffer) => {
		const listener = new t.AudioListener();
		camera.add(listener);
		const audio = new t.Audio(listener);
		audio.setLoop(true);
		return audio.setBuffer(buffer);
	});

	createAudio.then((audio) => {
		camera.add(audio.listener);
	});

	const createAudioAnalyzer = createAudio.then(
		(audio) => new t.AudioAnalyser(audio, FFT_SIZE),
	);

	const { materialParameters, outlineMaterialParameters } = createOutline();

	const geometry = new t.TorusKnotGeometry();
	const material = new t.MeshBasicMaterial(materialParameters);
	const mesh = new t.Mesh(geometry, material);

	const outlineMaterial = new t.MeshBasicMaterial({
		color: "black",
		depthTest: false,
		...outlineMaterialParameters,
	});

	onCleanup(() => {
		outlineMaterial.dispose();
		material.dispose();
		geometry.dispose();
	});

	const outline = new t.Mesh(geometry, outlineMaterial);

	const group = new t.Group().add(mesh, outline);
	const scene = new t.Scene().add(group);
	scene.background = new t.Color("#a37287");

	const orbit = new OrbitControls(camera);

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
				title: "outline",
			});

			const addBindings = createAudio.then((audio) => {
				pane.addBinding(outline, "visible");
				const audioFolder = pane.addFolder({
					title: "audio",
				});
				const play = audioFolder
					.addButton({
						title: "play",
					})
					.on("click", () => {
						audio.play();
						play.disabled = true;
						pause.disabled = !play.disabled;
					});

				const pause = audioFolder
					.addButton({
						title: "pause",
						disabled: !audio.isPlaying,
					})
					.on("click", () => {
						audio.pause();
						play.disabled = false;
						pause.disabled = !play.disabled;
					});
			});

			return () => {
				addBindings.then(() => {
					pane.dispose();
				});
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
				forceWebGL: true,
				stencil: true,
			});

			$effect(() => {
				renderer.setSize(rendererSize.width, rendererSize.height, false);
			});

			let lastTime = 0;
			const setAnimationLoop = createAudioAnalyzer.then((analyzer) => {
				return renderer.setAnimationLoop((time) => {
					const dt = time - lastTime;
					group.rotateY(dt / 1000);

					let scale = analyzer.getAverageFrequency();
					scale /= 255; // 0 -> 1
					scale *= 0.5; // 0 -> s
					scale += 1; // 1 -> 1 + s
					outline.scale.setScalar(scale);

					renderer.render(scene, camera);

					lastTime = time;
				});
			});

			return () => {
				setAnimationLoop.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
