<script
	lang="ts"
	module
>
	const cameraTranslationAxis = new Vector3(1, 1, 1).normalize();
	const positionYInitial = 2.5;
	const speed = 1 / 1000;

	const cameraTranslationAmount = 9;

	const textureCanvasSize = 128;

	const floorSize = 7;

	const sphereRadius = 1;

	const sphereDiameter = 2 * sphereRadius;
</script>

<script lang="ts">
	import { createShadowGradient } from "../createShadowGradient";

	import { controls } from "@attachments/controls";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import { lerp } from "three/src/math/MathUtils.js";
	import {
		CanvasTexture,
		Group,
		Mesh,
		MeshBasicMaterial,
		MeshNormalMaterial,
		PerspectiveCamera,
		PlaneGeometry,
		Scene,
		SphereGeometry,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const textureCanvas = new OffscreenCanvas(
		textureCanvasSize,
		textureCanvasSize,
	);

	const context = textureCanvas.getContext("2d");
	// can't really do anything if the context is null so just let the boundary catch the error
	if (context === null) {
		throw new Error("canvas texture context is null");
	}

	const gradient = createShadowGradient(context, "#ffffff");
	context.fillStyle = gradient;
	context.fillRect(0, 0, context.canvas.width, context.canvas.height);

	const shadowTexture = createDisposed(CanvasTexture, textureCanvas);

	const shadowMaterial = createDisposed(MeshBasicMaterial, {
		color: "#000000",
		depthWrite: false,
		map: shadowTexture,
		transparent: true,
	});

	const shadowGeometry = createDisposed(
		PlaneGeometry,
		sphereDiameter,
		sphereDiameter,
	);
	const shadowMesh = new Mesh(shadowGeometry, shadowMaterial).translateZ(0.01);

	const floorGeometry = createDisposed(PlaneGeometry, floorSize, floorSize);

	const floorMaterial = createDisposed(MeshBasicMaterial, {
		color: "#ccccaa",
	});

	const floorMesh = new Mesh(floorGeometry, floorMaterial);

	const group = new Group()
		.add(shadowMesh, floorMesh)
		.rotateX(-1 * 0.5 * Math.PI);

	const sphereGeometry = createDisposed(SphereGeometry);
	const sphereMaterial = createDisposed(MeshNormalMaterial);
	const sphereMesh = new Mesh(sphereGeometry, sphereMaterial);

	const scene = new Scene().add(sphereMesh, group);

	const camera = new PerspectiveCamera().translateOnAxis(
		cameraTranslationAxis,
		cameraTranslationAmount,
	);

	const orbit = new OrbitControls(camera);
</script>

<svelte:boundary>
	{#snippet failed(error)}
		<p>{error}</p>
	{/snippet}
</svelte:boundary>

<canvas
	class="aspect-square md:md:aspect-video"
	{@attach controls(orbit)}
	{@attach (canvas) => {
		const renderer = new WebGPURenderer({
			antialias: true,
			canvas,
		});

		const promise = renderer.setAnimationLoop((time) => {
			if (resize(renderer)) {
				const aspect = canvas.clientWidth / canvas.clientHeight;
				setCameraAspect(camera, aspect);
			}

			const t = 0.5 * (1 + Math.sin(time * speed));

			sphereMesh.position.y = lerp(
				positionYInitial - 1,
				positionYInitial + 1,
				t,
			);
			shadowMesh.scale.setScalar(1 + t);

			shadowMaterial.opacity = lerp(1, 0, t);

			renderer.render(scene, camera);
		});

		return () => {
			promise.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
