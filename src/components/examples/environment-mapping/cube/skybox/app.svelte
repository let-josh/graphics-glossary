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

	const loader = new t.TextureLoader();

	const cubeMapFiles = [
		posx.src,
		negx.src,
		posy.src,
		negy.src,
		posz.src,
		negz.src,
	] as const;

	const SPY_CAMERA_TRANSLATION_AXIS = new t.Vector3(1, 0.5, 1).normalize();
	const SPY_CAMERA_TRANSLATION_AMOUNT = 3;

	const speed = 1 / 4000;
	const amplitudeY = 0.3;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import { RendererSize, setRendererSize } from "@classes/RendererSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

	const { promise, resolve } = Promise.withResolvers<t.Texture[]>();

	$effect(() => {
		Promise.all(cubeMapFiles.map((url) => loader.loadAsync(url))).then(resolve);
	});

	const geometry = new t.BoxGeometry();

	const createMaterials = promise.then((textures) =>
		textures.map(
			(texture) =>
				new t.MeshBasicMaterial({
					depthWrite: false,
					map: texture,
					side: t.BackSide,
				}),
		),
	);

	const createCube = createMaterials.then(
		(materials) => new t.Mesh(geometry, materials),
	);

	const sceneCamera = new t.PerspectiveCamera(45, 1, 0.1, 1);
	const spyCamera = new t.PerspectiveCamera().translateOnAxis(
		SPY_CAMERA_TRANSLATION_AXIS,
		SPY_CAMERA_TRANSLATION_AMOUNT,
	);

	const helper = new t.CameraHelper(sceneCamera);
	helper.renderOrder += 1;
	helper.visible = false;

	const scene = new t.Scene().add(helper);
	const addCube = createCube.then((cube) => {
		scene.add(cube);
		return () => {
			scene.remove(cube);
		};
	});

	spyCamera.lookAt(scene.position);
	let camera = sceneCamera;
	const orbit = new OrbitControls(spyCamera);

	const canvasSize = new Size();
	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const rendererSize = RendererSize.fromSize(canvasSize);

	onCleanup(() => {
		geometry.dispose();
		helper.dispose();
		addCube.then((removeCube) => {
			removeCube();
		});
		createCube.then((cube) => {
			cube.geometry.dispose();
			for (const material of cube.material) {
				material.map?.dispose();
				material.map = null;
				material.dispose();
			}
		});
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

			const setAnimationLoop = renderer.setAnimationLoop((time) => {
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
