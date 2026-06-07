<script
	module
	lang="ts"
>
	import negx from "@assets/cubemaps/Lycksele/negx.jpg";
	import negy from "@assets/cubemaps/Lycksele/negy.jpg";
	import negz from "@assets/cubemaps/Lycksele/negz.jpg";
	import posx from "@assets/cubemaps/Lycksele/posx.jpg";
	import posy from "@assets/cubemaps/Lycksele/posy.jpg";
	import posz from "@assets/cubemaps/Lycksele/posz.jpg";

	const loader = new TextureLoader();

	const cubeMapFiles = [
		posx.src,
		negx.src,
		posy.src,
		negy.src,
		posz.src,
		negz.src,
	] as const;

	const SPY_CAMERA_TRANSLATION_AXIS = new Vector3(1, 0.5, 1).normalize();

	const speed = 1 / 4000;
	const amplitudeY = 0.3;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import {
		BackSide,
		BoxGeometry,
		CameraHelper,
		Mesh,
		MeshBasicMaterial,
		PerspectiveCamera,
		Scene,
		TextureLoader,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const geometry = createDisposed(BoxGeometry);
	const textures = await Promise.all(
		cubeMapFiles.map((url) => loader.loadAsync(url)),
	);
	onCleanup(() => {
		for (const texture of textures) texture.dispose();
	});

	const materials = textures.map((texture) =>
		createDisposed(MeshBasicMaterial, {
			depthWrite: false,
			map: texture,
			side: BackSide,
		}),
	);

	const sceneCamera = new PerspectiveCamera(45, 1, 0.1, 1);

	const cube = new Mesh(geometry, materials);
	const helper = createDisposed(CameraHelper, sceneCamera);
	helper.renderOrder += 1;
	helper.visible = false;

	const spyCamera = new PerspectiveCamera().translateOnAxis(
		SPY_CAMERA_TRANSLATION_AXIS,
		3,
	);

	const scene = new Scene().add(cube, helper);
	spyCamera.lookAt(scene.position);

	let camera = sceneCamera;
	const orbit = new OrbitControls(spyCamera);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "controls",
			},
			(pane) => {
				pane
					.addBinding(
						{
							showAll: camera === spyCamera,
						},
						"showAll",
						{
							label: "show all",
						},
					)
					.on("change", (e) => {
						camera = e.value ? spyCamera : sceneCamera;
						orbit.enabled = helper.visible = e.value;
					});
			},
		)}
	/>
	<canvas
		class="aspect-square"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				antialias: true,
				canvas,
			});

			const setAnimationLoop = renderer.setAnimationLoop((time) => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(spyCamera, aspect);
					setCameraAspect(sceneCamera, aspect);
				}

				time *= speed;
				const c = Math.cos(time);
				sceneCamera.lookAt(c, amplitudeY * c, Math.sin(time));
				if (helper.visible) helper.update();

				renderer.render(scene, camera);
			});

			return () => {
				setAnimationLoop.then(() => {
					renderer.dispose();
				});
			};
		}}
	></canvas>
</div>
