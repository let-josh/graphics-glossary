<script
	lang="ts"
	module
>
	const cameraTranslationAxis = new Vector3(1, 1, 1).normalize();
	const cameraTranslationAmount = 5;

	const detail = 1 << 8;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { pringle } from "@functions/parametric/pringle";
	import { createSphube } from "@functions/parametric/sphube";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import { ParametricGeometry } from "three/examples/jsm/geometries/ParametricGeometry.js";
	import {
		DoubleSide,
		Group,
		Mesh,
		MeshNormalMaterial,
		PerspectiveCamera,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const material = createDisposed(MeshNormalMaterial, {
		side: DoubleSide,
	});

	const sphubeGeometry = createDisposed(
		ParametricGeometry,
		createSphube(),
		detail,
		detail,
	);
	const pringleGeometry = createDisposed(
		ParametricGeometry,
		pringle,
		detail,
		detail,
	);

	const sphubeMesh = new Mesh(sphubeGeometry, material).translateX(-1);
	const pringleMesh = new Mesh(pringleGeometry, material).translateX(1);

	const group = new Group().add(pringleMesh, sphubeMesh);

	const camera = new PerspectiveCamera().translateOnAxis(
		cameraTranslationAxis,
		cameraTranslationAmount,
	);

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;
</script>

<canvas
	class="aspect-square md:md:aspect-video"
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
			renderer.render(group, camera);
		});

		return () => {
			promise.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
