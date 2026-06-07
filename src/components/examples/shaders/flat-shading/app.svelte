<script
	lang="ts"
	module
>
	const directionalLightTranslationAxis = new Vector3(
		0.25,
		0.25,
		1,
	).normalize();
	const directionalLightTranslationAmount = 3;

	const cameraTranslationAmount = 5;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import {
		AmbientLight,
		DirectionalLight,
		DirectionalLightHelper,
		Mesh,
		MeshLambertMaterial,
		PerspectiveCamera,
		Scene,
		SphereGeometry,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const geometry = createDisposed(SphereGeometry);

	const material = createDisposed(MeshLambertMaterial, {
		color: "#770077",
	});

	const mesh = new Mesh(geometry, material);
	mesh.visible = false;
	const flatShadingMaterial = material.clone();
	flatShadingMaterial.flatShading = true;

	const flatShadingMesh = new Mesh(geometry, flatShadingMaterial);

	const ambientLight = createDisposed(AmbientLight);
	const directionalLight = createDisposed(DirectionalLight).translateOnAxis(
		directionalLightTranslationAxis,
		directionalLightTranslationAmount,
	);

	const helper = createDisposed(DirectionalLightHelper, directionalLight);

	const scene = new Scene().add(
		mesh,
		flatShadingMesh,
		ambientLight,
		directionalLight,
		helper,
	);

	directionalLight.lookAt(scene.position);

	helper.update();

	const camera = new PerspectiveCamera();
	fitCameraToObject(camera, mesh, {
		fudge: 1.2,
	});

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
		class="aspect-square md:aspect-video"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				antialias: true,
				canvas,
			});

			const setAnimationLoop = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

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
