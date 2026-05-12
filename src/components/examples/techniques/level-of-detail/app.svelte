<script
	lang="ts"
	module
>
	const speed = 1 / 1000;

	const maxDistance = 15;
	const minDistance = 3;
	const halfway = 0.5 * (maxDistance + minDistance);

	const distances = [maxDistance, halfway, minDistance];

	const radius = 1;

	const cameraPositionZStart = 2 + maxDistance;
</script>

<script lang="ts">
	import { createDisposed } from "@functions/createDisposed.svelte";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { lerp } from "three/src/math/MathUtils.js";
	import type { BufferGeometry } from "three/webgpu";
	import {
		IcosahedronGeometry,
		LOD,
		Mesh,
		MeshNormalMaterial,
		PerspectiveCamera,
		WebGPURenderer,
	} from "three/webgpu";

	const lod = new LOD();

	const geometries: BufferGeometry[] = [];

	const material = createDisposed(MeshNormalMaterial, {
		flatShading: true,
	});

	for (let i = 0, l = distances.length; i < l; i += 1) {
		const geometry = createDisposed(IcosahedronGeometry, radius, i);

		geometries.push(geometry);
		const object = new Mesh(geometry, material);

		const distance = distances[i];

		lod.addLevel(object, distance);
	}

	onCleanup(() => {
		for (const distance of distances) lod.removeLevel(distance);
	});

	const cameraPositionZEnd = 2 + lod.position.z + radius;

	const camera = new PerspectiveCamera();
</script>

<canvas
	class="aspect-square md:aspect-video"
	{@attach (canvas) => {
		const renderer = new WebGPURenderer({
			antialias: true,
			canvas,
		});

		const promise = renderer.setAnimationLoop((time) => {
			if (resize(renderer)) {
				const aspect = canvas.clientWidth / canvas.clientHeight;
				setCameraAspect(camera, aspect);
			}
			time = 0.5 * (1 + Math.sin(time * speed));
			camera.position.z = lerp(cameraPositionZStart, cameraPositionZEnd, time);

			renderer.render(lod, camera);
		});

		return () => {
			promise.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
