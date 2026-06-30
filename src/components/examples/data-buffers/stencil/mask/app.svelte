<script module>
	const MASK_SCALE = 2;

	const hdrLoader = new HDRLoader();

	const STENCIL_REF = 1;

	const CAMERA_TRANSLATION_AXIS = new t.Vector3(0.25, 0.25, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 5;
</script>

<script lang="ts">
	import { createMask } from "./createMask";

	import portalHdrUrl from "@assets/hdrs/cobblestone_street_night_1k.hdr";
	import mainHdrUrl from "@assets/hdrs/suburban_garden_1k.hdr";

	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { HDRLoader, OrbitControls } from "three/addons";

	const camera = new t.PerspectiveCamera().translateOnAxis(
		CAMERA_TRANSLATION_AXIS,
		CAMERA_TRANSLATION_AMOUNT,
	);
	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	const knot = new t.Mesh(
		new t.TorusKnotGeometry(),
		new t.MeshStandardMaterial({
			roughness: 0,
			metalness: 1,
		}),
	).translateZ(-2);

	const { maskedMaterialParameters, maskMaterialParameters } =
		createMask(STENCIL_REF);

	const mask = new t.Mesh(
		new t.CircleGeometry(),
		new t.MeshBasicMaterial({
			colorWrite: false,
			depthTest: false,
			...maskMaterialParameters,
		}),
	);
	mask.scale.setScalar(MASK_SCALE);
	mask.renderOrder = -1;

	const ring = new t.Mesh(
		new t.RingGeometry(MASK_SCALE, MASK_SCALE + 0.1),
		new t.MeshBasicMaterial(),
	);

	const mainScene = new t.Scene().add(mask, ring);
	const portalScene = new t.Scene().add(knot);

	const setSceneEnvironment = (scene: t.Scene, hdr: t.Texture) => {
		const lastBackground = scene.background;
		const lastEnvironment = scene.environment;
		scene.background = scene.environment = hdr;
		return () => {
			scene.background = lastBackground;
			scene.environment = lastEnvironment;
		};
	};

	$effect(() => {
		const setPortalHDR = hdrLoader.loadAsync(portalHdrUrl).then((hdr) => {
			hdr.mapping = t.EquirectangularReflectionMapping;
			const unsetSceneEnvironment = setSceneEnvironment(portalScene, hdr);
			return () => {
				unsetSceneEnvironment();
				hdr.dispose();
			};
		});

		const setMainHDR = hdrLoader.loadAsync(mainHdrUrl).then((hdr) => {
			hdr.mapping = t.EquirectangularReflectionMapping;
			const unsetSceneEnvironment = setSceneEnvironment(mainScene, hdr);
			return () => {
				unsetSceneEnvironment();
				hdr.dispose();
			};
		});

		return () => {
			setPortalHDR.then((cleanup) => {
				cleanup();
			});
			setMainHDR.then((cleanup) => {
				cleanup();
			});
		};
	});

	const renderTarget = new t.RenderTarget(1, 1);

	const quadMaterial = new t.MeshBasicMaterial({
		...maskedMaterialParameters,
		map: renderTarget.texture,
	});

	const quad = new t.QuadMesh(quadMaterial);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	$effect(() => {
		renderTarget.setSize(rendererSize.width, rendererSize.height);
	});

	onCleanup(() => {
		knot.geometry.dispose();
		knot.material.dispose();

		ring.geometry.dispose();
		ring.material.dispose();

		mask.geometry.dispose();
		mask.material.dispose();

		renderTarget.dispose();

		quadMaterial.dispose();
	});
</script>

<canvas
	bind:clientWidth={canvasSize.width}
	bind:clientHeight={canvasSize.height}
	{@attach controls(orbit)}
	{@attach (canvas) => {
		const renderer = new t.WebGPURenderer({
			antialias: true,
			canvas,
			stencil: true,
			forceWebGL: true,
		});

		$effect(() => {
			renderer.setSize(rendererSize.width, rendererSize.height, false);
		});

		const setAnimationLoop = renderer.setAnimationLoop(() => {
			orbit.update();

			const lastTarget = renderer.getRenderTarget();
			renderer.setRenderTarget(renderTarget);
			renderer.render(portalScene, camera);

			renderer.setRenderTarget(lastTarget);
			renderer.render(mainScene, camera);

			const lastAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			quad.render(renderer);
			renderer.autoClear = lastAutoClear;
		});

		return () => {
			setAnimationLoop.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
