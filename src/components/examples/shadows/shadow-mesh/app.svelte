<script
	lang="ts"
	module
>
	const yHat = new Vector3(0, 1, 0);

	const DIRECTIONAL_LIGHT_TRANSLATION_AXIS = new Vector3(1, 1, -1).normalize();
	const DIRECTIONAL_LIGHT_TRANSLATION_AMOUNT = 7;

	const DEGREES = 1;
	const ANGLE = DEG2RAD * DEGREES;

	const FLOOR_SIZE = 15;
	const FLOOR_COLOR = "#ccccaa";

	const CAMERA_TRANSLATION_AXIS = new Vector3(1, 1, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 20;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import { Size } from "@classes/size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { devicePixelRatio } from "svelte/reactivity/window";
	import {
		DirectionalLight,
		DirectionalLightHelper,
		Mesh,
		MeshBasicMaterial,
		MeshNormalMaterial,
		Object3D,
		PerspectiveCamera,
		Plane,
		PlaneGeometry,
		Scene,
		TorusKnotGeometry,
		Vector3,
		Vector4,
		WebGLRenderer,
	} from "three";
	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import { ShadowMesh } from "three/examples/jsm/objects/ShadowMesh.js";
	import { DEG2RAD } from "three/src/math/MathUtils.js";

	let rotateMesh = $state(true);

	const geometry = createDisposed(TorusKnotGeometry);
	const material = createDisposed(MeshNormalMaterial);
	const mesh = new Mesh(geometry, material).translateY(2);

	const shadowMesh = new ShadowMesh(mesh);

	// offset the plane slightly from the ground
	const floorY = 0;
	const planeOffset = 0.01;
	const planeConstant = floorY + planeOffset;

	const plane = new Plane(yHat, planeConstant);

	const floorGeometry = createDisposed(PlaneGeometry, FLOOR_SIZE, FLOOR_SIZE);

	const floorMaterial = createDisposed(MeshBasicMaterial, {
		color: FLOOR_COLOR,
	});

	const floorMesh = new Mesh(floorGeometry, floorMaterial);
	floorMesh.lookAt(plane.normal);

	const light = createDisposed(DirectionalLight).translateOnAxis(
		DIRECTIONAL_LIGHT_TRANSLATION_AXIS,
		DIRECTIONAL_LIGHT_TRANSLATION_AMOUNT,
	);

	light.target = mesh;

	const lightHelper = createDisposed(DirectionalLightHelper, light);

	const lightPosition4D = new Vector4(...light.position, 0.01);

	const objects: Object3D[] = [mesh, shadowMesh, floorMesh, lightHelper];

	const scene = new Scene().add(...objects);

	const camera = new PerspectiveCamera().translateOnAxis(
		CAMERA_TRANSLATION_AXIS,
		CAMERA_TRANSLATION_AMOUNT,
	);

	const canvasSize = new Size();

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	let animationLoop: null | (() => void) = null;

	const orbit = new OrbitControls(camera);
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
							rotateMesh: true,
						},
						"rotateMesh",
						{
							label: "rotate",
						},
					)
					.on("change", (e) => {
						rotateMesh = e.value;
					});
			},
		)}
	/>
	<canvas
		class="aspect-square md:md:aspect-video"
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGLRenderer({
				antialias: true,
				canvas,
				stencil: true,
			});

			$effect(() => {
				renderer.setPixelRatio(devicePixelRatio.current ?? 1);
			});

			const render = () => {
				renderer.render(scene, camera);
			};

			$effect(() => {
				renderer.setSize(canvasSize.width, canvasSize.height, false);
				if (animationLoop === null) render();
			});

			$effect(() => {
				if (!rotateMesh) return;

				renderer.setAnimationLoop(
					(animationLoop = () => {
						mesh.rotateY(ANGLE);
						shadowMesh.update(plane, lightPosition4D);

						render();
					}),
				);

				return () => {
					renderer.setAnimationLoop((animationLoop = null));
				};
			});

			return () => {
				renderer.dispose();
			};
		}}
	>
	</canvas>
</div>
