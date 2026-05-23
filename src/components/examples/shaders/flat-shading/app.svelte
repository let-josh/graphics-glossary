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

	const cameraTranslationAxis = new Vector3(0, 0, 1);
	const cameraTranslationAmount = 5;

	const SHININESS_MAX = 300;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import {
		AmbientLight,
		DirectionalLight,
		DirectionalLightHelper,
		Mesh,
		MeshPhongMaterial,
		PerspectiveCamera,
		Scene,
		SphereGeometry,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const geometry = createDisposed(SphereGeometry);

	const material = createDisposed(MeshPhongMaterial, {
		color: "#770077",
		shininess: 0.5 * SHININESS_MAX,
	});

	const ambientLight = createDisposed(AmbientLight);
	const directionalLight = createDisposed(DirectionalLight).translateOnAxis(
		directionalLightTranslationAxis,
		directionalLightTranslationAmount,
	);

	const helper = createDisposed(DirectionalLightHelper, directionalLight);

	const mesh = new Mesh(geometry, material);
	mesh.visible = false;
	const flatShadingMaterial = createDisposed(MeshPhongMaterial).copy(material);
	flatShadingMaterial.flatShading = true;

	const flatShadingMesh = new Mesh(geometry, flatShadingMaterial);

	const scene = new Scene().add(
		mesh,
		flatShadingMesh,
		ambientLight,
		directionalLight,
		helper,
	);

	directionalLight.lookAt(scene.position);

	helper.update();

	const camera = new PerspectiveCamera().translateOnAxis(
		cameraTranslationAxis,
		cameraTranslationAmount,
	);

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;
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
					.addBinding(material, "shininess", {
						min: 0,
						max: SHININESS_MAX,
						step: 1,
					})
					.on("change", (e) => {
						flatShadingMaterial.shininess = e.value;
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

			const promise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

				orbit.update();
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
</div>
