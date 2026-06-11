<script
	module
	lang="ts"
>
	const colorAttributeTransformMatrix = new Matrix4().makeTranslation(
		new Vector3().setScalar(0.5),
	);

	const CAMERA_TRANSLATION_AXIS = new Vector3(1, 1, 1).normalize();
	const CAMERA_TRANSLATION_AMOUNT = 3;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import { RendererSize, setRendererSize } from "@classes/RendererSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import {
		BoxGeometry,
		Matrix4,
		Mesh,
		MeshBasicMaterial,
		PerspectiveCamera,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const geometry = new BoxGeometry();
	geometry.setAttribute(
		"color",
		geometry
			.getAttribute("position")
			.clone()
			.applyMatrix4(colorAttributeTransformMatrix),
	);

	const material = new MeshBasicMaterial({
		vertexColors: true,
	});

	const mesh = new Mesh(geometry, material);

	const camera = new PerspectiveCamera().translateOnAxis(
		CAMERA_TRANSLATION_AXIS,
		CAMERA_TRANSLATION_AMOUNT,
	);

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const canvasSize = new Size();

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const rendererSize = RendererSize.fromSize(canvasSize);

	onCleanup(() => {
		geometry.dispose();
		material.dispose();
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
				pane
					.addBinding(material, "vertexColors", {
						label: "vertex colors",
					})
					.on("change", () => {
						material.needsUpdate = true;
					});
			},
		)}
	/>

	<canvas
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				antialias: true,
				canvas,
			});

			$effect(() => {
				setRendererSize(renderer, rendererSize);
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
