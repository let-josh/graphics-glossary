<script
	lang="ts"
	module
>
	const CAMERA_TRANSLATION_AXIS = new Vector3(0, 1, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 10;

	const PLANE_SIZE = 5;

	const HALF_PLANE_SIZE = 0.5 * PLANE_SIZE;
	const SHADOW_CAMERA_FAR = 1;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import { DEG2RAD } from "three/src/math/MathUtils.js";
	import { depth, texture, uniform, vec3 } from "three/tsl";
	import {
		Color,
		Mesh,
		MeshNormalMaterial,
		NodeMaterial,
		OrthographicCamera,
		PerspectiveCamera,
		PlaneGeometry,
		RenderTarget,
		Scene,
		TorusKnotGeometry,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const uDarkness = uniform(1);
	const uShadowOpacity = uniform(1);
	const uBlur = uniform(3.5);

	const depthMaterial = createDisposed(NodeMaterial);
	depthMaterial.colorNode = vec3();
	depthMaterial.opacityNode = depth.oneMinus().mul(uDarkness);
	depthMaterial.depthTest = false;
	depthMaterial.depthWrite = false;

	const renderTargetSize = 1 << 8;
	const renderTarget = createDisposed(
		RenderTarget,
		renderTargetSize,
		renderTargetSize,
	);
	renderTarget.texture.generateMipmaps = false;

	const shadowPlaneMaterial = createDisposed(NodeMaterial);
	shadowPlaneMaterial.transparent = true;
	shadowPlaneMaterial.depthWrite = false;
	shadowPlaneMaterial.colorNode = vec3();
	shadowPlaneMaterial.opacityNode = gaussianBlur(
		texture(renderTarget.texture),
		uBlur,
	).a.mul(uShadowOpacity);

	const planeGeometry = createDisposed(PlaneGeometry, PLANE_SIZE, PLANE_SIZE);

	const shadowPlaneMesh = new Mesh(planeGeometry, shadowPlaneMaterial).rotateX(
		-1 * 0.5 * Math.PI,
	);

	const meshGeometry = createDisposed(TorusKnotGeometry, 1, 0.4, 64, 8, 3, 1);
	const meshMaterial = createDisposed(MeshNormalMaterial);
	const mesh = new Mesh(meshGeometry, meshMaterial).translateY(2);

	const shadowCamera = new OrthographicCamera(
		-1 * HALF_PLANE_SIZE,
		HALF_PLANE_SIZE,
		HALF_PLANE_SIZE,
		-1 * HALF_PLANE_SIZE,
		0,
		SHADOW_CAMERA_FAR,
	);
	shadowCamera.lookAt(mesh.position);

	const scene = new Scene().add(shadowPlaneMesh, mesh);
	scene.background = new Color("#eeeeee");

	const camera = new PerspectiveCamera().translateOnAxis(
		CAMERA_TRANSLATION_AXIS,
		CAMERA_TRANSLATION_AMOUNT,
	);
	camera.lookAt(mesh.position);

	const orbit = new OrbitControls(camera);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane({ title: "uniforms" }, (pane) => {
			pane.addBinding(uDarkness, "value", {
				label: "darkness",
				min: 0,
				max: 1,
				step: 0.1,
			});

			pane.addBinding(uShadowOpacity, "value", {
				label: "opacity",
				min: 0,
				max: 1,
				step: 0.1,
			});

			pane.addBinding(uBlur, "value", {
				label: "blur",
				min: 0,
				max: 5,
				step: 0.5,
			});
		})}
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

				mesh.rotateX(1 * DEG2RAD).rotateZ(0.5 * DEG2RAD);

				const lastBackground = scene.background;
				scene.background = null;

				const lastOverrideMaterial = scene.overrideMaterial;
				scene.overrideMaterial = depthMaterial;

				const lastRenderTarget = renderer.getRenderTarget();
				renderer.setRenderTarget(renderTarget);

				renderer.render(scene, shadowCamera);

				scene.background = lastBackground;
				scene.overrideMaterial = lastOverrideMaterial;
				renderer.setRenderTarget(lastRenderTarget);

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
