<script
	lang="ts"
	module
>
	const CAMERA_TRANSLATION_AXIS = new t.Vector3(0, 1, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 10;

	const PLANE_SIZE = 5;

	const HALF_PLANE_SIZE = 0.5 * PLANE_SIZE;
	const SHADOW_CAMERA_FAR = 1;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import { DEG2RAD } from "three/src/math/MathUtils.js";
	import { depth, texture, uniform, vec3 } from "three/tsl";

	const uDarkness = uniform(1);
	const uShadowOpacity = uniform(1);
	const uBlur = uniform(3.5);

	const depthMaterial = new t.NodeMaterial();
	depthMaterial.colorNode = vec3();
	depthMaterial.opacityNode = depth.oneMinus().mul(uDarkness);
	depthMaterial.depthTest = false;
	depthMaterial.depthWrite = false;

	const renderTargetSize = 1 << 8;
	const renderTarget = new t.RenderTarget(renderTargetSize, renderTargetSize);
	renderTarget.texture.generateMipmaps = false;

	const shadowPlaneMaterial = new t.NodeMaterial();
	shadowPlaneMaterial.transparent = true;
	shadowPlaneMaterial.depthWrite = false;
	shadowPlaneMaterial.colorNode = vec3();
	shadowPlaneMaterial.opacityNode = gaussianBlur(
		texture(renderTarget.texture),
		uBlur,
	).a.mul(uShadowOpacity);

	const shadowPlaneGeometry = new t.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);

	const shadowPlaneMesh = new t.Mesh(
		shadowPlaneGeometry,
		shadowPlaneMaterial,
	).rotateX(-1 * 0.5 * Math.PI);

	const meshGeometry = new t.TorusKnotGeometry(1, 0.4, 64, 8, 3, 1);
	const meshMaterial = new t.MeshNormalMaterial();
	const mesh = new t.Mesh(meshGeometry, meshMaterial).translateY(2);

	onCleanup(() => {
		meshGeometry.dispose();
		meshMaterial.dispose();
		shadowPlaneMaterial.dispose();
		depthMaterial.dispose();
		renderTarget.dispose();
		shadowPlaneGeometry.dispose();
	});

	const shadowCamera = new t.OrthographicCamera(
		-1 * HALF_PLANE_SIZE,
		HALF_PLANE_SIZE,
		HALF_PLANE_SIZE,
		-1 * HALF_PLANE_SIZE,
		0,
		SHADOW_CAMERA_FAR,
	);
	shadowCamera.lookAt(mesh.position);

	const scene = new t.Scene().add(shadowPlaneMesh, mesh);
	scene.background = new t.Color("#eeeeee");

	const camera = new t.PerspectiveCamera().translateOnAxis(
		CAMERA_TRANSLATION_AXIS,
		CAMERA_TRANSLATION_AMOUNT,
	);
	camera.lookAt(mesh.position);

	const orbit = new OrbitControls(camera);

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});
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
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new t.WebGPURenderer({
				antialias: true,
				canvas,
			});

			$effect(() => {
				renderer.setSize(rendererSize.width, rendererSize.height, false);
			});

			const setAnimationLoop = renderer.setAnimationLoop(() => {
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
