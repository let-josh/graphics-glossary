<script
	module
	lang="ts"
>
	const colorAttributeTransformMatrix = new t.Matrix4().makeTranslation(
		new t.Vector3().setScalar(0.5),
	);

	const CAMERA_TRANSLATION_AXIS = new t.Vector3(1, 1, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 3;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/addons";
	import { Pane } from "tweakpane";

	const geometry = new t.BoxGeometry();
	geometry.setAttribute(
		"color",
		geometry
			.getAttribute("position")
			.clone()
			.applyMatrix4(colorAttributeTransformMatrix),
	);

	const material = new t.MeshBasicMaterial({
		vertexColors: true,
	});

	const mesh = new t.Mesh(geometry, material);

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

	onCleanup(() => {
		geometry.dispose();
		material.dispose();
	});
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach (container) => {
			const pane = new Pane({
				container,
				title: "controls",
			});

			pane
				.addBinding(material, "vertexColors", {
					label: "vertex colors",
				})
				.on("change", () => {
					material.needsUpdate = true;
				});
		}}
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
				orbit.update();
				renderer.render(mesh, camera);
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
