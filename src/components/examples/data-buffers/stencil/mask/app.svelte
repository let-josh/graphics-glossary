<script
	module
	lang="ts"
>
	import portalHdrUrl from "@assets/hdrs/cobblestone_street_night_1k.hdr";
	import mainHdrUrl from "@assets/hdrs/suburban_garden_1k.hdr";

	const CAMERA_TRANSLATION_AXIS = new Vector3(0.25, 0.25, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 5;

	const loader = new HDRLoader();

	const MASK_SCALE = 2;

	const STENCIL_REF = 1;

	const KNOT_ROTATION_AMOUNT = Math.PI * (1 / 240);
</script>

<script lang="ts">
	import { createMask } from "./createMask";

	import { controls } from "@attachments/controls";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { HDRLoader } from "three/examples/jsm/Addons.js";
	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import {
		CircleGeometry,
		EquirectangularReflectionMapping,
		Mesh,
		MeshBasicMaterial,
		MeshStandardMaterial,
		PerspectiveCamera,
		QuadMesh,
		RenderTarget,
		RingGeometry,
		Scene,
		TorusKnotGeometry,
		Vector2,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const { maskedMaterialParameters, maskMaterialParameters } =
		createMask(STENCIL_REF);

	const renderTarget = createDisposed(RenderTarget, 1, 1);

	const knotGeometry = createDisposed(TorusKnotGeometry);
	const knotMaterial = createDisposed(MeshStandardMaterial, {
		roughness: 0,
		metalness: 1,
	});

	const knot = new Mesh(knotGeometry, knotMaterial).translateZ(-2);

	const maskGeometry = createDisposed(CircleGeometry);
	const maskMaterial = createDisposed(MeshBasicMaterial, {
		colorWrite: false,
		depthTest: false,
		...maskMaterialParameters,
	});

	const ringGeometry = createDisposed(
		RingGeometry,
		MASK_SCALE,
		MASK_SCALE + 0.1,
	);
	const ringMaterial = createDisposed(MeshBasicMaterial);
	const ring = new Mesh(ringGeometry, ringMaterial);

	const mask = new Mesh(maskGeometry, maskMaterial);
	mask.scale.setScalar(MASK_SCALE);
	mask.renderOrder = -1;

	const camera = new PerspectiveCamera().translateOnAxis(
		CAMERA_TRANSLATION_AXIS,
		CAMERA_TRANSLATION_AMOUNT,
	);

	const mainScene = new Scene().add(mask, ring);
	const portalScene = new Scene().add(knot);

	const hdrs = [
		{ scene: mainScene, hdr: mainHdrUrl },
		{ scene: portalScene, hdr: portalHdrUrl },
	];

	const hdrTextures = await Promise.all(
		hdrs.map(({ scene, hdr }) =>
			loader.loadAsync(hdr).then((texture) => {
				texture.mapping = EquirectangularReflectionMapping;
				scene.background = scene.environment = texture;
				return texture;
			}),
		),
	);

	onCleanup(() => {
		for (const texture of hdrTextures) texture.dispose();
	});

	const quadMaterial = createDisposed(MeshBasicMaterial, {
		...maskedMaterialParameters,
		map: renderTarget.texture,
	});

	const quad = new QuadMesh(quadMaterial);

	const orbit = new OrbitControls(camera);

	const rendererSize = new Vector2();
</script>

<canvas
	class="aspect-square md:aspect-video"
	{@attach controls(orbit)}
	{@attach (canvas) => {
		const renderer = new WebGPURenderer({
			antialias: true,
			canvas,
			forceWebGL: true,
			stencil: true,
		});

		const promise = renderer.setAnimationLoop(() => {
			knot.rotateY(KNOT_ROTATION_AMOUNT);
			if (resize(renderer)) {
				const aspect = canvas.clientWidth / canvas.clientHeight;
				setCameraAspect(camera, aspect);
				renderer.getSize(rendererSize);
				renderTarget.setSize(rendererSize.width, rendererSize.height);
			}

			const previousTarget = renderer.getRenderTarget();
			renderer.setRenderTarget(renderTarget);
			renderer.render(portalScene, camera);

			renderer.setRenderTarget(previousTarget);
			renderer.render(mainScene, camera);

			const previousAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			quad.render(renderer);
			renderer.autoClear = previousAutoClear;
		});

		return () => {
			promise.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
