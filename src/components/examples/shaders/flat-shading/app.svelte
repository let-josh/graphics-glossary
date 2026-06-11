<script
	lang="ts"
	module
>
	const directionalLightTranslationAxis = new t.Vector3(
		0.25,
		0.25,
		1,
	).normalize();
	const directionalLightTranslationAmount = 3;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import { RendererSize, setRendererSize } from "@classes/RendererSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

	const geometry = new t.SphereGeometry();

	const material = new t.MeshLambertMaterial({
		color: "#770077",
	});

	const mesh = new t.Mesh(geometry, material);
	mesh.visible = false;
	const flatShadingMaterial = material.clone();
	flatShadingMaterial.flatShading = true;

	const flatShadingMesh = new t.Mesh(geometry, flatShadingMaterial);

	const ambientLight = new t.AmbientLight();
	const directionalLight = new t.DirectionalLight().translateOnAxis(
		directionalLightTranslationAxis,
		directionalLightTranslationAmount,
	);

	const helper = new t.DirectionalLightHelper(directionalLight);

	const scene = new t.Scene().add(
		mesh,
		flatShadingMesh,
		ambientLight,
		directionalLight,
		helper,
	);

	directionalLight.lookAt(scene.position);

	helper.update();

	const camera = new t.PerspectiveCamera();
	fitCameraToObject(camera, mesh, {
		fudge: 1.2,
	});

	const orbit = new OrbitControls(camera);

	const canvasSize = new Size();

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const rendererSize = RendererSize.fromSize(canvasSize);

	onCleanup(() => {
		helper.dispose();
		ambientLight.dispose();
		material.dispose();
		flatShadingMaterial.dispose();
		geometry.dispose();
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
				const materialFolder = pane.addFolder({
					title: "material",
				});

				materialFolder
					.addBinding(
						{
							color: `#${material.color.getHexString()}`,
						},
						"color",
					)
					.on("change", (e) => {
						flatShadingMaterial.color.copy(material.color.set(e.value));
					});

				const sceneFolder = pane.addFolder({
					title: "scene",
				});

				sceneFolder.addBinding(helper, "visible", {
					label: "show light helper",
				});

				sceneFolder
					.addBinding(flatShadingMesh, "visible", {
						label: "flat shading",
					})
					.on("change", (e) => {
						mesh.visible = !e.value;
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

			const setAnimationLoop = renderer.setAnimationLoop(() => {
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
</div>
