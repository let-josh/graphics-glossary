<script lang="ts">
	import { ROOT_PARENT_INDEX, create, intersect } from "./bvh";

	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/addons";
	import { Pane } from "tweakpane";

	const canvasSize = new Size();

	const camera = new t.PerspectiveCamera(60, 1, 0.01, 10);

	const orbit = new OrbitControls(camera);

	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	// const geometry = new t.SphereGeometry();
	// const geometry = new t.PlaneGeometry(1, 1, 2, 2);
	// const geometry = new t.BoxGeometry();
	const geometry = new t.TorusKnotGeometry();
	const indexAttribute = geometry.getIndex();
	if (indexAttribute === null)
		throw new Error("nonindexed geometry is not supported yet");

	const positionAttribute = geometry.getAttribute("position");
	const mesh = new t.Mesh(
		geometry,
		new t.MeshBasicMaterial({
			color: "orangered",
			transparent: true,
			opacity: 0.05,
			wireframe: true,
		}),
	);

	const box = new t.Box3();
	fitCameraToObject(camera, mesh, {
		box,
		fudge: 2,
	});
	box.getCenter(orbit.target);

	const linePositionAttribute = new t.BufferAttribute(
		new Float32Array(3 * 4),
		3,
	);
	const lineGeometry = new t.BufferGeometry().setAttribute(
		"position",
		linePositionAttribute,
	);

	const line = new t.Line(lineGeometry);
	line.renderOrder = 1;

	const nodes = create(positionAttribute.array, indexAttribute.array);

	const raycaster = new t.Raycaster();

	const coords = new t.Vector2();

	const a = new t.Vector3();
	const b = new t.Vector3();
	const c = new t.Vector3();
	const points = [a, b, c, a];

	let lastClosestTriangleIndex: null | number = null;

	const boxes = new t.Group();
	const scene = new t.Scene().add(line, mesh, boxes);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach (container) => {
			const pane = new Pane({
				container,
				title: "controls",
			});
			pane.addBinding(boxes, "visible", {
				label: "show bounds",
			});
			return () => {
				pane.dispose();
			};
		}}
	/>
	<canvas
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		onpointermove={(event) => {
			const ndcX = 2 * (event.offsetX / event.currentTarget.clientWidth) - 1;
			const ndcY = -2 * (event.offsetY / event.currentTarget.clientHeight) + 1;

			raycaster.setFromCamera(coords.set(ndcX, ndcY), camera);

			const intersections = intersect(
				raycaster.ray,
				nodes,
				positionAttribute,
				indexAttribute,
			);

			let closestDistance = Infinity;
			let closestTriangleIndex: null | number = null;
			for (let { nodeIndex, triangleIndex, distanceSquared } of intersections) {
				if (distanceSquared < closestDistance) {
					closestDistance = distanceSquared;
					closestTriangleIndex = triangleIndex;
				}

				if (closestTriangleIndex === lastClosestTriangleIndex) return;

				const path: number[] = [];

				while (nodeIndex !== ROOT_PARENT_INDEX) {
					path.push(nodeIndex);
					const node = nodes[nodeIndex];
					nodeIndex = node.parentIndex;
				}

				boxes.clear();

				const l = path.length;
				const m = 1 / l;

				for (let i = 0; i < l; i += 1) {
					const index = path[i];
					const node = nodes[index];
					const hue = m * i;
					const color = new t.Color().setHSL(hue, 1, 1 - hue);
					const helper = new t.Box3Helper(node, color);
					helper.addEventListener("removed", (event) => {
						event.target.dispose();
					});
					boxes.add(helper);
				}

				if (closestTriangleIndex !== null) {
					a.fromBufferAttribute(
						positionAttribute,
						indexAttribute.getX(closestTriangleIndex),
					);
					b.fromBufferAttribute(
						positionAttribute,
						indexAttribute.getY(closestTriangleIndex),
					);
					c.fromBufferAttribute(
						positionAttribute,
						indexAttribute.getZ(closestTriangleIndex),
					);

					lineGeometry.setFromPoints(points);
				}
				lastClosestTriangleIndex = closestTriangleIndex;
			}
		}}
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
