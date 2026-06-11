<script
	lang="ts"
	module
>
	const cameraTranslationAxis = new t.Vector3(1, 1, 1).normalize();
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

	import { RendererSize, setRendererSize } from "@classes/RendererSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import { lerp } from "three/src/math/MathUtils.js";
	import { texture } from "three/tsl";

	$effect(() => {
		const textureCanvas = new OffscreenCanvas(
			textureCanvasSize,
			textureCanvasSize,
		);
		const context = textureCanvas.getContext("2d");
		// can't really do anything if the context is null so just let the boundary catch the error
		if (context === null) throw new Error("canvas texture context is null");

		const gradient = createShadowGradient(context);
		context.fillStyle = gradient;
		context.fillRect(0, 0, context.canvas.width, context.canvas.height);

		colorNode.value = new t.CanvasTexture(textureCanvas);
	});

	const colorNode = texture();

	const shadowMaterial = new t.MeshBasicNodeMaterial({
		depthWrite: false,
		colorNode,
		transparent: true,
	});

	const shadowGeometry = new t.PlaneGeometry(sphereDiameter, sphereDiameter);
	const shadowMesh = new t.Mesh(shadowGeometry, shadowMaterial).translateZ(
		0.01,
	);

	const floorGeometry = new t.PlaneGeometry(floorSize, floorSize);

	const floorMaterial = new t.MeshBasicMaterial({
		color: "#ccccaa",
	});

	const floorMesh = new t.Mesh(floorGeometry, floorMaterial);

	const group = new t.Group()
		.add(shadowMesh, floorMesh)
		.rotateX(-1 * 0.5 * Math.PI);

	const sphereGeometry = new t.SphereGeometry();
	const sphereMaterial = new t.MeshNormalMaterial();
	const sphereMesh = new t.Mesh(sphereGeometry, sphereMaterial);

	const scene = new t.Scene().add(sphereMesh, group);

	const camera = new t.PerspectiveCamera().translateOnAxis(
		cameraTranslationAxis,
		cameraTranslationAmount,
	);

	const orbit = new OrbitControls(camera);

	const canvasSize = new Size();

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const rendererSize = RendererSize.fromSize(canvasSize);

	onCleanup(() => {
		sphereMaterial.dispose();
		sphereGeometry.dispose();
		floorMaterial.dispose();
		floorGeometry.dispose();
		shadowGeometry.dispose();
		shadowMaterial.dispose();
	});
</script>

<svelte:boundary>
	{#snippet failed(error)}
		<p>{error}</p>
	{/snippet}
</svelte:boundary>

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
			setAnimationLoop.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
