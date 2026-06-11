<script
	lang="ts"
	module
>
	const yHat = new t.Vector3(0, 1, 0);

	const DIRECTIONAL_LIGHT_TRANSLATION_AXIS = new t.Vector3(
		1,
		1,
		-1,
	).normalize();
	const DIRECTIONAL_LIGHT_TRANSLATION_AMOUNT = 7;

	const DEGREES = 1;
	const ANGLE = DEG2RAD * DEGREES;

	const FLOOR_SIZE = 15;
	const FLOOR_COLOR = "#ccccaa";

	const CAMERA_TRANSLATION_AXIS = new t.Vector3(1, 1, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 20;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import { RendererSize } from "@classes/RendererSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three";
	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import { ShadowMesh } from "three/examples/jsm/objects/ShadowMesh.js";
	import { DEG2RAD } from "three/src/math/MathUtils.js";

	let rotateMesh = $state(true);

	const geometry = new t.TorusKnotGeometry();
	const material = new t.MeshNormalMaterial();
	const mesh = new t.Mesh(geometry, material).translateY(2);

	const shadowMesh = new ShadowMesh(mesh);

	// offset the plane slightly from the ground
	const floorY = 0;
	const planeOffset = 0.01;
	const planeConstant = floorY + planeOffset;

	const plane = new t.Plane(yHat, planeConstant);

	const floorGeometry = new t.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);

	const floorMaterial = new t.MeshBasicMaterial({
		color: FLOOR_COLOR,
	});

	const floorMesh = new t.Mesh(floorGeometry, floorMaterial);
	floorMesh.lookAt(plane.normal);

	const light = new t.DirectionalLight().translateOnAxis(
		DIRECTIONAL_LIGHT_TRANSLATION_AXIS,
		DIRECTIONAL_LIGHT_TRANSLATION_AMOUNT,
	);

	light.target = mesh;

	const lightHelper = new t.DirectionalLightHelper(light);

	const lightPosition4D = new t.Vector4(...light.position, 0.01);

	const objects: t.Object3D[] = [mesh, shadowMesh, floorMesh, lightHelper];

	const scene = new t.Scene().add(...objects);

	const camera = new t.PerspectiveCamera().translateOnAxis(
		CAMERA_TRANSLATION_AXIS,
		CAMERA_TRANSLATION_AMOUNT,
	);

	const canvasSize = new Size();

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const rendererSize = RendererSize.fromSize(canvasSize);

	let animationLoop: null | (() => void) = null;

	const orbit = new OrbitControls(camera);

	onCleanup(() => {
		geometry.dispose();
		material.dispose();
		floorGeometry.dispose();
		floorMaterial.dispose();
		light.dispose();
		lightHelper.dispose();
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
		class="aspect-square md:aspect-video"
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new t.WebGLRenderer({
				antialias: true,
				canvas,
				stencil: true,
			});

			const render = () => {
				renderer.render(scene, camera);
			};

			$effect(() => {
				renderer.setSize(rendererSize.width, rendererSize.height, false);
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
