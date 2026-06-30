<script
	lang="ts"
	module
>
	const CAMERA_TRANSLATION_AXIS = new t.Vector3(1, 1, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 5;

	const detail = 1 << 8;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { pringle } from "@functions/parametric/pringle";
	import { createSphube } from "@functions/parametric/sphube";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls, ParametricGeometry } from "three/addons";

	const material = new t.MeshNormalMaterial({
		side: t.DoubleSide,
	});

	const sphubeGeometry = new ParametricGeometry(createSphube(), detail, detail);
	const pringleGeometry = new ParametricGeometry(pringle, detail, detail);

	onCleanup(() => {
		material.dispose();
		sphubeGeometry.dispose();
		pringleGeometry.dispose();
	});

	const sphubeMesh = new t.Mesh(sphubeGeometry, material).translateX(-1);
	const pringleMesh = new t.Mesh(pringleGeometry, material).translateX(1);

	const group = new t.Group().add(pringleMesh, sphubeMesh);

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

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
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
		});

		$effect(() => {
			renderer.setSize(rendererSize.width, rendererSize.height, false);
		});

		const setAnimationLoop = renderer.setAnimationLoop(() => {
			orbit.update();
			renderer.render(group, camera);
		});

		return () => {
			setAnimationLoop.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
