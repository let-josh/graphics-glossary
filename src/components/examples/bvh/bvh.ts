import * as t from "three/webgpu";

type PositionAttribute = ReturnType<t.BufferGeometry["getAttribute"]>;
type IndexAttribute = NonNullable<ReturnType<t.BufferGeometry["getIndex"]>>;

type PositionAttributeArray = PositionAttribute["array"];
type IndexAttributeArray = IndexAttribute["array"];

const ROOT_INDEX = 0;

class Bin extends t.Box3 {
	triangleCount = 0;
}

export const ROOT_PARENT_INDEX = -1;

class BvhNode extends Bin {
	parentIndex = ROOT_PARENT_INDEX;
	// first triangle index if the node is a leaf otherwise the index of the left child
	firstOrLeftIndex = 0;
}

const _dummyVector = new t.Vector3();

const sahHalfSurfaceArea = (size: t.Vector3) =>
	size.x * size.y + size.y * size.z + size.z * size.x;

const split = (
	nodeIndex: number,
	nodes: BvhNode[],
	indices: IndexAttributeArray,
	centroids: t.TypedArray,
	bounds: t.TypedArray,
	state = {
		nodesUsed: 1,
	},
) => {
	let bestAxisIndex = 0,
		bestSplitPosition = 0,
		minCost = Infinity,
		bestBoundsMin = 0,
		bestBoundsDiff = 0;

	const leftBox = new t.Box3();
	const rightBox = new t.Box3();
	const bestLeftBox = new t.Box3();
	const bestRightBox = new t.Box3();

	const binCount = 8;
	const binCountMinus1 = binCount - 1;

	const leftBoxes = Array.from({ length: binCountMinus1 }, () => new t.Box3());
	const rightBoxes = Array.from({ length: binCountMinus1 }, () => new t.Box3());

	const bins: Bin[] = [];
	const node = nodes[nodeIndex];
	for (let k = 0; k < binCount; k += 1) {
		bins.push(new Bin());
	}

	for (let axisIndex = 0; axisIndex < 3; axisIndex += 1) {
		let boundsMin = Infinity;
		let boundsMax = -Infinity;

		for (let i = 0, n = node.triangleCount; i < n; i += 1) {
			const triangleIndex = 3 * (node.firstOrLeftIndex + i);
			const centroid = centroids[triangleIndex + axisIndex];
			boundsMin = Math.min(boundsMin, centroid);
			boundsMax = Math.max(boundsMax, centroid);
		}

		if (boundsMin === boundsMax) continue;

		for (const bin of bins) {
			bin.makeEmpty();
			bin.triangleCount = 0;
		}

		const boundsDiff = boundsMax - boundsMin;
		const scale = binCount / boundsDiff;

		for (let i = 0, n = node.triangleCount; i < n; i += 1) {
			const triangleIndex = 3 * (node.firstOrLeftIndex + i);
			const centroid = centroids[triangleIndex + axisIndex];
			const binIndex = Math.min(
				binCountMinus1,
				Math.floor(scale * (centroid - boundsMin)),
			);

			const boundsIndex = 2 * triangleIndex;
			bins[binIndex]
				.expandByPoint(_dummyVector.fromArray(bounds, boundsIndex))
				.expandByPoint(_dummyVector.fromArray(bounds, boundsIndex + 3));
			bins[binIndex].triangleCount += 1;
		}

		let leftSum = 0;
		let rightSum = 0;

		const leftCounts: number[] = Array(binCountMinus1);
		const leftHalfAreas: number[] = Array(binCountMinus1);

		const rightCounts: number[] = Array(binCountMinus1);
		const rightHalfAreas: number[] = Array(binCountMinus1);

		leftBox.makeEmpty();
		rightBox.makeEmpty();

		for (let i = 0; i < binCountMinus1; i += 1) {
			leftSum += bins[i].triangleCount;
			leftCounts[i] = leftSum;

			leftBox.union(bins[i]);
			leftBoxes[i].copy(leftBox);
			leftHalfAreas[i] = sahHalfSurfaceArea(leftBox.getSize(_dummyVector));
		}
		for (let i = binCountMinus1 - 1; i >= 0; i -= 1) {
			rightSum += bins[i + 1].triangleCount;
			rightCounts[i] = rightSum;
			rightBox.union(bins[i + 1]);
			rightBoxes[i].copy(rightBox);

			rightHalfAreas[i] = sahHalfSurfaceArea(rightBox.getSize(_dummyVector));
		}

		for (let i = 0; i < binCountMinus1; i += 1) {
			const cost =
				leftCounts[i] * leftHalfAreas[i] + rightCounts[i] * rightHalfAreas[i];
			if (cost < minCost) {
				minCost = cost;
				bestAxisIndex = axisIndex;
				bestSplitPosition = i + 1;
				bestLeftBox.copy(leftBoxes[i]);
				bestRightBox.copy(rightBoxes[i]);
				bestBoundsMin = boundsMin;
				bestBoundsDiff = boundsDiff;
			}
		}
	}

	const size = node.getSize(_dummyVector);
	const nodeCost = node.triangleCount * sahHalfSurfaceArea(size);
	if (minCost >= nodeCost) return;

	let i = node.firstOrLeftIndex;
	let j = i + node.triangleCount - 1;

	const scale = binCount / bestBoundsDiff;
	while (i <= j) {
		const binIndex = Math.min(
			binCountMinus1,
			Math.floor(scale * (centroids[3 * i + bestAxisIndex] - bestBoundsMin)),
		);
		if (binIndex < bestSplitPosition) i += 1;
		else {
			const offsetI = 3 * i;
			const offsetJ = 3 * j;
			swap(indices, offsetI, offsetJ, 3);
			swap(bounds, 2 * offsetI, 2 * offsetJ, 6);
			swap(centroids, offsetI, offsetJ, 3);

			j -= 1;
		}
	}

	const leftCount = i - node.firstOrLeftIndex;
	if (leftCount === 0 || leftCount === node.triangleCount) return;

	const leftChildIndex = state.nodesUsed;
	state.nodesUsed += 1;
	const left = nodes[leftChildIndex];
	left.firstOrLeftIndex = node.firstOrLeftIndex;
	left.parentIndex;
	left.triangleCount = leftCount;
	left.parentIndex = nodeIndex;
	left.copy(bestLeftBox);

	const rightChildIndex = state.nodesUsed;
	state.nodesUsed += 1;
	const right = nodes[rightChildIndex];
	right.firstOrLeftIndex = i;
	right.triangleCount = node.triangleCount - leftCount;
	right.parentIndex = nodeIndex;
	right.copy(bestRightBox);

	split(leftChildIndex, nodes, indices, centroids, bounds, state);
	split(rightChildIndex, nodes, indices, centroids, bounds, state);

	node.firstOrLeftIndex = leftChildIndex;
	node.triangleCount = 0;
};

export const create = (
	positions: PositionAttributeArray,
	indices: IndexAttributeArray,
) => {
	const triangleCount = indices.length / 3;

	const nodes = Array.from(
		{
			length: 2 * triangleCount - 1,
		},
		() => new BvhNode(),
	);

	const root = nodes[ROOT_INDEX];
	root.triangleCount = triangleCount;

	// x0, y0, z0, x1, y1, z1, ... - 3 floats per triangle
	const centroids = new Float32Array(3 * triangleCount);

	// minX, minY, minZ, maxX, maxY, maxZ - 3 * 2 floats per triangle
	const bounds = new Float32Array(3 * 2 * triangleCount);

	for (let i = 0; i < triangleCount; i += 1) {
		const triangleIndex = 3 * i;

		const i0 = 3 * indices[triangleIndex];
		const i1 = 3 * indices[triangleIndex + 1];
		const i2 = 3 * indices[triangleIndex + 2];

		const v0x = positions[i0];
		const v0y = positions[i0 + 1];
		const v0z = positions[i0 + 2];
		const v1x = positions[i1];
		const v1y = positions[i1 + 1];
		const v1z = positions[i1 + 2];
		const v2x = positions[i2];
		const v2y = positions[i2 + 1];
		const v2z = positions[i2 + 2];

		centroids[triangleIndex] = (v0x + v1x + v2x) / 3;
		centroids[triangleIndex + 1] = (v0y + v1y + v2y) / 3;
		centroids[triangleIndex + 2] = (v0z + v1z + v2z) / 3;

		const boundsIndex = 2 * triangleIndex;
		bounds[boundsIndex] = Math.min(v0x, v1x, v2x);
		bounds[boundsIndex + 1] = Math.min(v0y, v1y, v2y);
		bounds[boundsIndex + 2] = Math.min(v0z, v1z, v2z);
		bounds[boundsIndex + 3] = Math.max(v0x, v1x, v2x);
		bounds[boundsIndex + 4] = Math.max(v0y, v1y, v2y);
		bounds[boundsIndex + 5] = Math.max(v0z, v1z, v2z);

		root
			.expandByPoint(_dummyVector.fromArray(bounds, boundsIndex))
			.expandByPoint(_dummyVector.fromArray(bounds, boundsIndex + 3));
	}

	split(ROOT_INDEX, nodes, indices, centroids, bounds);
	return nodes;
};

const swap = (array: t.TypedArray, i: number, j: number, count: number) => {
	for (let k = 0; k < count; k += 1) {
		const temp = array[i + k];
		array[i + k] = array[j + k];
		array[j + k] = temp;
	}
};

export type Intersection = {
	nodeIndex: number;
	triangleIndex: number;
	point: t.Vector3;
	distanceSquared: number;
};

const _a = new t.Vector3();
const _b = new t.Vector3();
const _c = new t.Vector3();
export const intersect = (
	ray: t.Ray,
	nodes: BvhNode[],
	positionAttribute: PositionAttribute,
	indexAttribute: IndexAttribute,
	nodeIndex = ROOT_INDEX,
	intersections: Intersection[] = [],
) => {
	const stack = [nodeIndex];
	while (stack.length > 0) {
		const nodeIndex = stack.pop() ?? null;
		if (nodeIndex === null) break;
		const node = nodes[nodeIndex];
		for (let i = 0, count = node.triangleCount; i < count; i += 1) {
			const triangleIndex = 3 * (node.firstOrLeftIndex + i);
			const intersection = ray.intersectTriangle(
				_a.fromBufferAttribute(
					positionAttribute,
					indexAttribute.getX(triangleIndex),
				),
				_b.fromBufferAttribute(
					positionAttribute,
					indexAttribute.getY(triangleIndex),
				),
				_c.fromBufferAttribute(
					positionAttribute,
					indexAttribute.getZ(triangleIndex),
				),
				false,
				_dummyVector,
			);
			if (intersection === null) continue;
			const distanceSquared = _dummyVector.distanceToSquared(ray.origin);
			intersections.push({
				nodeIndex,
				triangleIndex,
				point: _dummyVector.clone(),
				distanceSquared,
			});
		}
		if (node.triangleCount < 1) {
			const leftIndex = node.firstOrLeftIndex;
			const rightIndex = node.firstOrLeftIndex + 1;

			const leftDistance =
				ray
					.intersectBox(nodes[leftIndex], _dummyVector)
					?.distanceToSquared(ray.origin) ?? Infinity;

			const rightDistance =
				ray
					.intersectBox(nodes[rightIndex], _dummyVector)
					?.distanceToSquared(ray.origin) ?? Infinity;

			let closerIndex = leftIndex,
				closerDistance = leftDistance,
				furtherIndex = rightIndex,
				furtherDistance = rightDistance;

			if (rightDistance < leftDistance) {
				let temp = closerIndex;
				closerIndex = rightIndex;
				furtherIndex = temp;

				temp = closerDistance;
				closerDistance = rightDistance;
				furtherDistance = temp;
			}

			if (closerDistance < Infinity) {
				if (furtherDistance < Infinity) stack.push(furtherIndex);
				stack.push(closerIndex);
			}
		}
	}
	return intersections;
};
