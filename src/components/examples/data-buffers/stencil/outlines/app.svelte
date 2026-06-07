<script
	module
	lang="ts"
>
	import audioUrl from "@assets/audio/Stadium-Rave-A.ogg";
	import environmentTextureUrl from "@assets/hdrs/university_workshop_1k.hdr";

	const hdrLoader = new HDRLoader();

	const audioLoader = new AudioLoader();
</script>

<script lang="ts">
	import { createOutline } from "./createOutline";

	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { HDRLoader, OrbitControls } from "three/examples/jsm/Addons.js";
	import {
		Audio,
		AudioAnalyser,
		AudioListener,
		AudioLoader,
		EquirectangularReflectionMapping,
		Group,
		Mesh,
		MeshBasicMaterial,
		MeshStandardMaterial,
		PerspectiveCamera,
		Scene,
		TorusKnotGeometry,
		WebGPURenderer,
	} from "three/webgpu";

	const listener = new AudioListener();
	const audio = new Audio(listener);
	audio.setLoop(true);

	const buffer = await audioLoader.loadAsync(audioUrl);
	audio.setBuffer(buffer);

	const audioAnalyser = new AudioAnalyser(audio, 256);

	const environmentTexture = await hdrLoader.loadAsync(environmentTextureUrl);
	environmentTexture.mapping = EquirectangularReflectionMapping;
	onCleanup(() => {
		environmentTexture.dispose();
	});

	const { materialParameters, outlineMaterialParameters } = createOutline();

	const geometry = createDisposed(TorusKnotGeometry);
	const material = createDisposed(MeshStandardMaterial, {
		...materialParameters,
		roughness: 0.5,
		metalness: 0.9,
	});
	const mesh = new Mesh(geometry, material);

	const outlineMaterial = createDisposed(MeshBasicMaterial, {
		color: "black",
		depthTest: false,
		...outlineMaterialParameters,
	});

	const outline = new Mesh(geometry, outlineMaterial);
	outline.scale.setScalar(1.05);

	const group = new Group().add(mesh, outline);
	const scene = new Scene().add(group);
	scene.environment = scene.background = environmentTexture;

	const camera = new PerspectiveCamera().translateZ(7);
	camera.add(listener);

	const orbit = new OrbitControls(camera);

	let lastTime = 0;

	const outlineScale = 0.3;
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "outline",
			},
			(pane) => {
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
				forceWebGL: true,
				stencil: true,
			});

			const setAnimationLoop = renderer.setAnimationLoop((time) => {
				const dt = time - lastTime;
				group.rotateY(dt / 1000);

				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

				if (audio.isPlaying) {
					let scale = audioAnalyser.getAverageFrequency();
					scale /= 255; // 0 -> 1
					scale *= outlineScale; // 0 -> s
					scale += 1; // 1 -> 1 + s
					outline.scale.setScalar(scale);
				}

				renderer.render(scene, camera);

				lastTime = time;
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
