import { DRACOLoader } from "three/addons";
import type { GLTFLoader } from "three/addons";

const _dracoLoader = new DRACOLoader().setDecoderPath(
	"https://www.gstatic.com/draco/v1/decoders/",
);

export const setDRACOLoader = (
	gltfLoader: GLTFLoader,
	dracoLoader = _dracoLoader,
) => {
	gltfLoader.setDRACOLoader(dracoLoader);
};
