import * as THREE from "three";

import Stats from "https://unpkg.com/three@0.141.0/examples/jsm/libs/stats.module.js";
import { GUI } from "https://unpkg.com/three@0.141.0/examples/jsm/libs/lil-gui.module.min.js";

import { OrbitControls } from "https://unpkg.com/three@0.141.0/examples/jsm/controls/OrbitControls.js";
import { OutlineEffect } from "https://unpkg.com/three@0.141.0/examples/jsm/effects/OutlineEffect.js";
import { MMDLoader } from "https://unpkg.com/three@0.141.0/examples/jsm/loaders/MMDLoader.js";
import { MMDAnimationHelper } from "https://unpkg.com/three@0.141.0/examples/jsm/animation/MMDAnimationHelper.js";

import { EnglishBoneName } from "./EnglishBone.js";

import "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js";
import "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js";

const videoElement = document.getElementsByClassName("input_video")[0];
const canvasElement = document.getElementsByClassName("output_canvas")[0];
const canvasCtx = canvasElement.getContext("2d");

let stats;

let effect;
let helper, ikHelper, physicsHelper;
let holistic;
let bool_animation = true;

const clock = new THREE.Clock();

Ammo().then(function (AmmoLib) {
  Ammo = AmmoLib;
  holistic = new Holistic({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
    },
  });

  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: true,
    smoothSegmentation: true,
    refineFaceLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  // video
  videoElement.play();
  async function detectionFrame() {
    await holistic.send({ image: videoElement });
    videoElement.requestVideoFrameCallback(detectionFrame);
  }
  detectionFrame();
  init();
});

function init() {
  holistic.onResults(onResults2);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const render_w = videoElement.videoWidth;
  const render_h = videoElement.videoHeight;
  renderer.setSize(render_w, render_h);
  renderer.setViewport(0, 0, render_w, render_h);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const camera_ar = new THREE.PerspectiveCamera(
    45,
    render_w / render_h,
    0.1,
    3000
  );
  camera_ar.position.set(-5, 25, 20);
  camera_ar.up.set(0, 1, 0);
  camera_ar.lookAt(0, 1, 0);

  const camera_world = new THREE.PerspectiveCamera(
    45,
    render_w / render_h,
    1,
    1000
  );
  camera_world.position.set(0, 1, 3);
  camera_world.up.set(0, 1, 0);
  camera_world.lookAt(0, 1, 0);
  camera_world.updateProjectionMatrix();
  const controls = new OrbitControls(camera_ar, renderer.domElement);
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.target.set(0, 1, -1);
  controls.update();

  // scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0a0a0);
  scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.position.set(3, 10, 10);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 5;
  dirLight.shadow.camera.bottom = -5;
  dirLight.shadow.camera.left = -5;
  dirLight.shadow.camera.right = 5;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 500;
  scene.add(dirLight);

  const ground_mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  );
  ground_mesh.rotation.x = -Math.PI / 2;
  ground_mesh.receiveShadow = true;
  scene.add(ground_mesh);
  const grid_helper = new THREE.GridHelper(1000, 1000);
  grid_helper.rotation.x = Math.PI / 2;
  ground_mesh.add(grid_helper);

  let model,
    skeleton = null,
    skeleton_helper;

  helper = new MMDAnimationHelper({
    afterglow: 2.0,
  });

  const loader = new MMDLoader();
  let i = 0;
  loader.load("../model/PMD/pmd_model.pmd", function (object) {
    model = object;
    console.log(model);
    model.position.y = 15;

    scene.add(model);
    let bones = [];
    model.traverse(function (object) {
      if (object.isBone) {
        object.name = EnglishBoneName[i];
        bones.push(object);
        i++;
      }
    });
    model.geometry.userData.MMD.iks.pop();
    model.geometry.userData.MMD.iks.pop();
    model.geometry.userData.MMD.iks.pop();
    model.geometry.userData.MMD.iks.pop();
    console.log(model.geometry.userData.MMD.iks);
    model.geometry.userData.MMD.iks.push({
      target: 136,
      effector: 120,
      links: [{ index: 119 }, { index: 118 }, { index: 117 }],
    });
    model.geometry.userData.MMD.iks.push({
      target: 0,
      effector: 111,
      links: [{ index: 110 }, { index: 109 }, { index: 108 }, { index: 107 }],
    });
    model.geometry.userData.MMD.iks.push({
      target: 0,
      effector: 116,
      links: [{ index: 115 }, { index: 114 }, { index: 113 }, { index: 112 }],
    });
    helper.add(model, {
      physics: true,
    });
    ikHelper = helper.objects.get(model).ikSolver.createHelper();
    ikHelper.visible = false;
    scene.add(ikHelper);

    physicsHelper = helper.objects.get(model).physics.createHelper();
    physicsHelper.visible = false;

    bones.forEach(function (bone) {
      console.log(bone.name);
    });

    scene.add(physicsHelper);
    skeleton = new THREE.Skeleton(bones);
    skeleton.getBoneByName("Left thumb 2").name = "Left thumb 3";
    skeleton.getBoneByName("Left thumb 1").name = "Left thumb 2";
    skeleton.getBoneByName("Left thumb 0").name = "Left thumb 1";
    skeleton.getBoneByName("Right thumb 2").name = "Right thumb 3";
    skeleton.getBoneByName("Right thumb 1").name = "Right thumb 2";
    skeleton.getBoneByName("Right thumb 0").name = "Right thumb 1";

    skeleton.getBoneByName("left parent fingertip").name = "Left thumb 4";
    skeleton.getBoneByName("left-handed fingertip").name = "Left Finger 4";
    skeleton.getBoneByName("left middle fingertip").name =
      "Left middle finger 4";
    skeleton.getBoneByName("left tip of the drug").name = "Left ring finger 4";
    skeleton.getBoneByName("left small fingertip").name =
      "Left little finger 4";

    skeleton.getBoneByName("right parent fingertip").name = "Right thumb 4";
    skeleton.getBoneByName("right index fingertip").name = "Right Finger 4";
    skeleton.getBoneByName("right middle fingertip").name =
      "Right middle finger 4";
    skeleton.getBoneByName("right tip of the drug").name =
      "Right ring finger 4";
    skeleton.getBoneByName("right small fingertip").name =
      "Right little finger 4";

    skeleton_helper = new THREE.SkeletonHelper(model);
    skeleton_helper.visible = true;
    scene.add(skeleton_helper);
    initGui();
  });

  effect = new OutlineEffect(renderer);

  // STATS
  stats = new Stats();
  container.appendChild(stats.dom);

  let name_to_index = {
    nose: 0,
    left_eye_inner: 1,
    left_eye: 2,
    left_eye_outer: 3,
    right_eye_inner: 4,
    right_eye: 5,
    right_eye_outer: 6,
    left_ear: 7,
    right_ear: 8,
    mouth_left: 9,
    mouth_right: 10,
    left_shoulder: 11,
    right_shoulder: 12,
    left_elbow: 13,
    right_elbow: 14,
    left_wrist: 15,
    right_wrist: 16,
    left_pinky: 17,
    right_pinky: 18,
    left_index: 19,
    right_index: 20,
    left_thumb: 21,
    right_thumb: 22,
    left_hip: 23,
    right_hip: 24,
    left_knee: 25,
    right_knee: 26,
    left_ankle: 27,
    right_ankle: 28,
    left_heel: 29,
    right_heel: 30,
    left_foot_index: 31,
    right_foot_index: 32,
  };
  let index_to_name = {};
  let index_to_name_hands = {};
  for (const [key, value] of Object.entries(name_to_index)) {
    index_to_name[value] = key;
  }

  let name_to_index_hands = {
    wrist: 0,
    thumb_finger_mcp: 1, // thumb_cmc
    thumb_finger_pip: 2, // thumb_mcp
    thumb_finger_dip: 3, // thumb_ip
    thumb_finger_tip: 4, // thumb_tip
    index_finger_mcp: 5,
    index_finger_pip: 6,
    index_finger_dip: 7,
    index_finger_tip: 8,
    middle_finger_mcp: 9,
    middle_finger_pip: 10,
    middle_finger_dip: 11,
    middle_finger_tip: 12,
    ring_finger_mcp: 13,
    ring_finger_pip: 14,
    ring_finger_dip: 15,
    ring_finger_tip: 16,
    pinky_finger_mcp: 17, // pinky_mcp
    pinky_finger_pip: 18, // pinky_mcp
    pinky_finger_dip: 19, // pinky_mcp
    pinky_finger_tip: 20, // pinky_mcp
  };
  for (const [key, value] of Object.entries(name_to_index_hands)) {
    index_to_name_hands[value] = key;
  }
  let axis_helper_root = new THREE.AxesHelper(1);
  axis_helper_root.position.set(0, 0.001, 0);
  scene.add(axis_helper_root);

  const poselandmarks_points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: 0xff0000,
      size: 1,
      sizeAttenuation: true,
    })
  );
  const Newposelandmarks_points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: 0x0000ff,
      size: 1,
      sizeAttenuation: true,
    })
  );
  const l_handlandmarks_points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: 0x00ff00,
      size: 0.5,
      sizeAttenuation: true,
    })
  );
  const r_handlandmarks_points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.5,
      sizeAttenuation: true,
    })
  );
  poselandmarks_points.geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(33 * 3), 3)
  );
  Newposelandmarks_points.geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(11 * 3), 3)
  );
  l_handlandmarks_points.geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(21 * 3), 3)
  );
  r_handlandmarks_points.geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(21 * 3), 3)
  );
  scene.add(poselandmarks_points);
  scene.add(Newposelandmarks_points);
  scene.add(l_handlandmarks_points);
  scene.add(r_handlandmarks_points);

  function computeR(A, B) {
    // get unit vectors
    const uA = A.clone().normalize();
    const uB = B.clone().normalize();

    // get products
    const idot = uA.dot(uB);
    const cross_AB = new THREE.Vector3().crossVectors(uA, uB);
    const cdot = cross_AB.length();

    // get new unit vectors
    const u = uA.clone();
    const v = new THREE.Vector3()
      .subVectors(uB, uA.clone().multiplyScalar(idot))
      .normalize();
    const w = cross_AB.clone().normalize();

    // get change of basis matrix
    const C = new THREE.Matrix4().makeBasis(u, v, w).transpose();

    // get rotation matrix in new basis
    const R_uvw = new THREE.Matrix4().set(
      idot,
      -cdot,
      0,
      0,
      cdot,
      idot,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    );

    // full rotation matrix
    //const R = new Matrix4().multiplyMatrices(new Matrix4().multiplyMatrices(C, R_uvw), C.clone().transpose());
    const R = new THREE.Matrix4().multiplyMatrices(
      C.clone().transpose(),
      new THREE.Matrix4().multiplyMatrices(R_uvw, C)
    );
    return R;
  }
  let custom_gravity = new THREE.Vector3(0, -0.098, 0);
  //loop
  function onResults2(results) {
    stats.begin();
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );

    {
      canvasCtx.globalCompositeOperation = "destination-atop";
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );
      canvasCtx.globalCompositeOperation = "source-over";
      drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 1,
      });
      drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: "#FF0000",
        radius: 0.5,
      });
      drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {
        color: "#CC0000",
        lineWidth: 1,
      });
      drawLandmarks(canvasCtx, results.leftHandLandmarks, {
        color: "#00FF00",
        lineWidth: 0.5,
      });
      drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {
        color: "#00CC00",
        lineWidth: 1,
      });
      drawLandmarks(canvasCtx, results.rightHandLandmarks, {
        color: "#00FFFF",
        lineWidth: 0.5,
      });
      canvasCtx.restore();
    }

    function update3dpose(camera, dist_from_cam, offset, poseLandmarks) {
      // if the camera is orthogonal, set scale to 1
      const ip_lt = new THREE.Vector3(-50, 50, -50).unproject(camera);
      const ip_rb = new THREE.Vector3(50, -50, -50).unproject(camera);
      const ip_diff = new THREE.Vector3().subVectors(ip_rb, ip_lt);
      const x_scale = Math.abs(ip_diff.x);

      function ProjScale(p_ms, cam_pos, src_d, dst_d) {
        let vec_cam2p = new THREE.Vector3().subVectors(p_ms, cam_pos);
        return new THREE.Vector3().addVectors(
          cam_pos,
          vec_cam2p.multiplyScalar(dst_d / src_d)
        );
      }

      let pose3dDict = {};
      for (const [key, value] of Object.entries(poseLandmarks)) {
        let p_3d = new THREE.Vector3(
          (value.x - 0.5) * 2.0,
          -(value.y - 0.5) * 2.0,
          0
        ).unproject(camera);
        p_3d.z = -value.z * x_scale - camera.near + camera.position.z;
        p_3d = ProjScale(p_3d, camera.position, camera.near, dist_from_cam);
        pose3dDict[key] = p_3d.add(offset);
      }

      return pose3dDict;
    }

    function SetRbyCalculatingJoints(
      joint_mp,
      joint_mp_child,
      joint_model,
      joint_model_child,
      R_chain
    ) {
      const v = new THREE.Vector3()
        .subVectors(joint_mp_child, joint_mp)
        .normalize();

      const R = computeR(
        joint_model_child.position.clone().normalize(),
        v.applyMatrix4(R_chain.clone().transpose())
      );
      joint_model.quaternion.setFromRotationMatrix(R);

      R_chain.multiply(R);
    }
    // Loop
    let R_chain_rightupper,
      R_chain_leftupper,
      pose_left_wrist,
      pose_right_wrist;
    if (bool_animation == true) {
      if (results.poseLandmarks) {
        // pose
        let pose_landmarks_dict = {};
        let newJoints3D = {};
        results.poseLandmarks.forEach((landmark, i) => {
          pose_landmarks_dict[index_to_name[i]] = landmark;
        });

        let pos_3d_landmarks = update3dpose(
          camera_world,
          15,
          new THREE.Vector3(10, 10, 10),
          pose_landmarks_dict
        );

        let i = 0;
        for (const [key, value] of Object.entries(pos_3d_landmarks)) {
          poselandmarks_points.geometry.attributes.position.array[3 * i + 0] =
            value.x;
          poselandmarks_points.geometry.attributes.position.array[3 * i + 1] =
            value.y;
          poselandmarks_points.geometry.attributes.position.array[3 * i + 2] =
            value.z;
          i++;
        }
        poselandmarks_points.geometry.attributes.position.needsUpdate = true;
        pose_left_wrist = pos_3d_landmarks["left_wrist"];
        pose_right_wrist = pos_3d_landmarks["right_wrist"];
        // add landmarks for spine
        const center_hips = new THREE.Vector3()
          .addVectors(
            pos_3d_landmarks["left_hip"],
            pos_3d_landmarks["right_hip"]
          )
          .multiplyScalar(0.5);
        const center_shoulders = new THREE.Vector3()
          .addVectors(
            pos_3d_landmarks["left_shoulder"],
            pos_3d_landmarks["right_shoulder"]
          )
          .multiplyScalar(0.5);
        let center_ear = new THREE.Vector3()
          .addVectors(
            pos_3d_landmarks["left_ear"],
            pos_3d_landmarks["right_ear"]
          )
          .multiplyScalar(0.5);
        center_ear.z *= 0.5;

        const dir_spine = new THREE.Vector3().subVectors(
          center_shoulders,
          center_hips
        );
        const length_spine = dir_spine.length();
        dir_spine.normalize();

        const dir_shoulders = new THREE.Vector3().subVectors(
          pos_3d_landmarks["right_shoulder"],
          pos_3d_landmarks["left_shoulder"]
        );

        newJoints3D["hips"] = new THREE.Vector3().addVectors(
          center_hips,
          dir_spine.clone().multiplyScalar(length_spine / 9.0)
        );
        newJoints3D["spine0"] = new THREE.Vector3().addVectors(
          center_hips,
          dir_spine.clone().multiplyScalar((length_spine / 9.0) * 3)
        );
        newJoints3D["spine1"] = new THREE.Vector3().addVectors(
          center_hips,
          dir_spine.clone().multiplyScalar((length_spine / 9.0) * 5)
        );
        newJoints3D["spine2"] = new THREE.Vector3().addVectors(
          center_hips,
          dir_spine.clone().multiplyScalar((length_spine / 9.0) * 7)
        );
        const neck = new THREE.Vector3().addVectors(
          center_shoulders,
          dir_spine.clone().multiplyScalar(length_spine / 9.0)
        );
        newJoints3D["neck"] = neck;
        newJoints3D["shoulder_left"] = new THREE.Vector3().addVectors(
          pos_3d_landmarks["left_shoulder"],
          dir_shoulders.clone().multiplyScalar(1 / 3.0)
        );
        newJoints3D["shoulder_right"] = new THREE.Vector3().addVectors(
          pos_3d_landmarks["left_shoulder"],
          dir_shoulders.clone().multiplyScalar(2 / 3.0)
        );
        const dir_head = new THREE.Vector3().subVectors(center_ear, neck);
        newJoints3D["head"] = new THREE.Vector3().addVectors(
          neck,
          dir_head.clone().multiplyScalar(0.5)
        );
        const dir_right_foot = new THREE.Vector3().subVectors(
          pos_3d_landmarks["right_foot_index"],
          pos_3d_landmarks["right_heel"]
        );
        newJoints3D["right_toe_highheel"] = new THREE.Vector3().addVectors(
          pos_3d_landmarks["right_heel"],
          dir_right_foot.clone().multiplyScalar(0.5)
        );
        const dir_left_foot = new THREE.Vector3().subVectors(
          pos_3d_landmarks["left_foot_index"],
          pos_3d_landmarks["left_heel"]
        );
        newJoints3D["left_toe_highheel"] = new THREE.Vector3().addVectors(
          pos_3d_landmarks["left_heel"],
          dir_left_foot.clone().multiplyScalar(0.5)
        );
        const dir_another_head = new THREE.Vector3().subVectors(
          pos_3d_landmarks["nose"],
          newJoints3D["head"]
        );
        newJoints3D["head_for_avatar"] = new THREE.Vector3().addVectors(
          newJoints3D["head"],
          dir_another_head.clone().multiplyScalar(0.8)
        );

        i = 0;
        for (const [key, value] of Object.entries(newJoints3D)) {
          Newposelandmarks_points.geometry.attributes.position.array[
            3 * i + 0
          ] = value.x;
          Newposelandmarks_points.geometry.attributes.position.array[
            3 * i + 1
          ] = value.y;
          Newposelandmarks_points.geometry.attributes.position.array[
            3 * i + 2
          ] = value.z;
          i++;
        }
        Newposelandmarks_points.geometry.attributes.position.needsUpdate = true;

        // hip
        const jointHips = newJoints3D["hips"];
        const jointLeftUpLeg = pos_3d_landmarks["left_hip"];
        const jointRightUpLeg = pos_3d_landmarks["right_hip"];
        const jointSpine0 = newJoints3D["spine0"];

        const boneHips = skeleton.getBoneByName("center"); // hip
        const boneLeftUpLeg = skeleton.getBoneByName("left foot"); // L Up leg
        const boneRightUpLeg = skeleton.getBoneByName("right foot"); // R Up Leg
        const boneSpine0 = skeleton.getBoneByName("Upper body 2"); // spine

        const v_HiptoLeft = new THREE.Vector3()
          .subVectors(jointLeftUpLeg, jointHips)
          .normalize();
        const v_HiptoRight = new THREE.Vector3()
          .subVectors(jointRightUpLeg, jointHips)
          .normalize();
        const v_HiptoSpine0 = new THREE.Vector3()
          .subVectors(jointSpine0, jointHips)
          .normalize();

        const R_HiptoLeft = computeR(
          boneLeftUpLeg.position.clone().normalize(),
          v_HiptoLeft
        );
        const Q_HiptoLeft = new THREE.Quaternion().setFromRotationMatrix(
          R_HiptoLeft
        );
        const R_HiptoRight = computeR(
          boneRightUpLeg.position.clone().normalize(),
          v_HiptoRight
        );
        const Q_HiptoRight = new THREE.Quaternion().setFromRotationMatrix(
          R_HiptoRight
        );
        const R_HiptoSpine0 = computeR(
          boneSpine0.position.clone().normalize(),
          v_HiptoSpine0
        );
        const Q_HiptoSpine0 = new THREE.Quaternion().setFromRotationMatrix(
          R_HiptoSpine0
        );
        const Q_Hips = new THREE.Quaternion()
          .copy(Q_HiptoSpine0)
          .slerp(Q_HiptoLeft.clone().slerp(Q_HiptoRight, 0.5), 1 / 3);

        const test_R = new THREE.Matrix4().makeRotationX(1.8);
        skeleton.getBoneByName("center").quaternion.copy(Q_Hips);
        boneHips.quaternion.copy(Q_Hips);
        const R_Hips = new THREE.Matrix4().extractRotation(boneHips.matrix);

        // neck
        let R_chain_neck = new THREE.Matrix4().identity();
        R_chain_neck.multiply(R_Hips);
        const jointNeck = newJoints3D["neck"];
        const jointHead = newJoints3D["head"];
        const boneNeck = skeleton.getBoneByName("neck");
        const boneHead = skeleton.getBoneByName("head");
        SetRbyCalculatingJoints(
          jointNeck,
          jointHead,
          boneNeck,
          boneHead,
          R_chain_neck
        );
        const jointAnotherHead = newJoints3D["head_for_avatar"];
        const jointLeftEye = pos_3d_landmarks["left_eye"];
        const jointRightEye = pos_3d_landmarks["right_eye"];
        const boneLeftEye = skeleton.getBoneByName("left eye");
        const boneRightEye = skeleton.getBoneByName("right eye");
        const v_LeftEye = new THREE.Vector3()
          .subVectors(jointLeftEye, jointAnotherHead)
          .normalize();
        const v_RightEye = new THREE.Vector3()
          .subVectors(jointRightEye, jointAnotherHead)
          .normalize();
        const R_HeadtoLeftEye = computeR(
          boneLeftEye.position.clone().normalize(),
          v_LeftEye.clone().applyMatrix4(R_chain_neck.clone().transpose())
        );
        const R_HeadtoRightEye = computeR(
          boneRightEye.position.clone().normalize(),
          v_RightEye.clone().applyMatrix4(R_chain_neck.clone().transpose())
        );
        const Q_HeadtoLeftEye = new THREE.Quaternion().setFromRotationMatrix(
          R_HeadtoLeftEye
        );
        const Q_HeadtoRightEye = new THREE.Quaternion().setFromRotationMatrix(
          R_HeadtoRightEye
        );
        const Q_Head = new THREE.Quaternion()
          .copy(Q_HeadtoLeftEye)
          .slerp(Q_HeadtoRightEye, 0.5);
        boneHead.quaternion.copy(Q_Head);

        // Left shoulder-elbow-wrist
        R_chain_leftupper = new THREE.Matrix4().identity();
        R_chain_leftupper.multiply(R_Hips);
        const jointLeftShoulder_inside = newJoints3D["shoulder_left"];
        const jointLeftShoulder = pos_3d_landmarks["left_shoulder"];
        const jointLeftElbow = pos_3d_landmarks["left_elbow"];
        const jointLeftWrist = pos_3d_landmarks["left_wrist"];

        const boneLeftShoulder = skeleton.getBoneByName("Left shoulder P");
        const boneLeftArm = skeleton.getBoneByName("Left shoulder C");
        const boneLeftForeArm = skeleton.getBoneByName("left elbow");
        const boneLeftHand = skeleton.getBoneByName("left wrist");

        SetRbyCalculatingJoints(
          jointLeftShoulder_inside,
          jointLeftShoulder,
          boneLeftShoulder,
          boneLeftArm,
          R_chain_leftupper
        );
        SetRbyCalculatingJoints(
          jointLeftShoulder,
          jointLeftElbow,
          boneLeftArm,
          boneLeftForeArm,
          R_chain_leftupper
        );
        SetRbyCalculatingJoints(
          jointLeftElbow,
          jointLeftWrist,
          boneLeftForeArm,
          boneLeftHand,
          R_chain_leftupper
        );

        // Right shoulder-elbow-wrist
        R_chain_rightupper = new THREE.Matrix4().identity();
        R_chain_rightupper.multiply(R_Hips);
        const jointRightShoulder_inside = newJoints3D["shoulder_left"];
        const jointRightShoulder = pos_3d_landmarks["right_shoulder"];
        const jointRightElbow = pos_3d_landmarks["right_elbow"];
        const jointRightWrist = pos_3d_landmarks["right_wrist"];

        const boneRightShoulder = skeleton.getBoneByName("Right shoulder P");
        const boneRightArm = skeleton.getBoneByName("Right shoulder C");
        const boneRightForeArm = skeleton.getBoneByName("right elbow");
        const boneRightHand = skeleton.getBoneByName("right wrist");

        SetRbyCalculatingJoints(
          jointRightShoulder_inside,
          jointRightShoulder,
          boneRightShoulder,
          boneRightArm,
          R_chain_rightupper
        );
        SetRbyCalculatingJoints(
          jointRightShoulder,
          jointRightElbow,
          boneRightArm,
          boneRightForeArm,
          R_chain_rightupper
        );
        SetRbyCalculatingJoints(
          jointRightElbow,
          jointRightWrist,
          boneRightForeArm,
          boneRightHand,
          R_chain_rightupper
        );

        // left upleg-leg-foot
        let R_chain_leftlower = new THREE.Matrix4().identity();
        R_chain_leftlower.multiply(R_Hips);
        const jointLeftKnee = pos_3d_landmarks["left_knee"];
        const jointLeftAnkle = pos_3d_landmarks["left_ankle"];
        const jointLeftToeHighHeel = newJoints3D["left_toe_highheel"];
        const jointLeftFoot = pos_3d_landmarks["left_foot_index"];

        const boneLeftLeg = skeleton.getBoneByName("left knee");
        const boneLeftFoot = skeleton.getBoneByName("left ankle");
        const boneLeftToe_End = skeleton.getBoneByName("left toe");

        SetRbyCalculatingJoints(
          jointLeftUpLeg,
          jointLeftKnee,
          boneLeftUpLeg,
          boneLeftLeg,
          R_chain_leftlower
        );
        SetRbyCalculatingJoints(
          jointLeftKnee,
          jointLeftAnkle,
          boneLeftLeg,
          boneLeftFoot,
          R_chain_leftlower
        );
        SetRbyCalculatingJoints(
          jointLeftAnkle,
          jointLeftToeHighHeel,
          boneLeftFoot,
          boneLeftToe_End,
          R_chain_leftlower
        );

        // Right upleg-leg-foot
        let R_chain_rightlower = new THREE.Matrix4().identity();
        R_chain_rightlower.multiply(R_Hips);

        const jointRightKnee = pos_3d_landmarks["right_knee"];
        const jointRightAnkle = pos_3d_landmarks["right_ankle"];
        const jointRightToeHighHeel = newJoints3D["right_toe_highheel"];
        const jointRightFoot = pos_3d_landmarks["right_foot_index"];

        const boneRightLeg = skeleton.getBoneByName("right knee");
        const boneRightFoot = skeleton.getBoneByName("right ankle");
        const boneRightToeBase = skeleton.getBoneByName(
          "mixamorigRightToeBase"
        );
        const boneRightToe_End = skeleton.getBoneByName("right toe");

        SetRbyCalculatingJoints(
          jointRightUpLeg,
          jointRightKnee,
          boneRightUpLeg,
          boneRightLeg,
          R_chain_rightlower
        );
        SetRbyCalculatingJoints(
          jointRightKnee,
          jointRightAnkle,
          boneRightLeg,
          boneRightFoot,
          R_chain_rightlower
        );
        SetRbyCalculatingJoints(
          jointRightAnkle,
          jointRightToeHighHeel,
          boneRightFoot,
          boneRightToe_End,
          R_chain_rightlower
        );
      }
      const right_toe_worldposition = new THREE.Vector3();
      skeleton.getBoneByName("right toe").matrixWorldNeedsUpdate = true;
      skeleton
        .getBoneByName("right toe")
        .getWorldPosition(right_toe_worldposition);

      const left_toe_worldposition = new THREE.Vector3();
      skeleton.getBoneByName("left toe").matrixWorldNeedsUpdate = true;
      skeleton
        .getBoneByName("left toe")
        .getWorldPosition(left_toe_worldposition);

      if (right_toe_worldposition.y > 0 && left_toe_worldposition.y > 0) {
        skeleton.getBoneByName("every parent").position.add(custom_gravity);
        custom_gravity.add(new THREE.Vector3(0, -0.098, 0));
      } else if (right_toe_worldposition.y < 0) {
        skeleton
          .getBoneByName("every parent")
          .position.add(new THREE.Vector3(0, -right_toe_worldposition.y, 0));
        custom_gravity.set(0, -0.098, 0);
      } else if (left_toe_worldposition.y < 0) {
        skeleton
          .getBoneByName("every parent")
          .position.add(new THREE.Vector3(0, -left_toe_worldposition.y, 0));
        custom_gravity.set(0, -0.098, 0);
      }
      // hand
      if (results.leftHandLandmarks) {
        let hand_landmarks_dict = {};
        results.leftHandLandmarks.forEach((landmark, i) => {
          hand_landmarks_dict[index_to_name_hands[i]] = landmark;
        });
        let hand_3d_landmarks = update3dpose(
          camera_world,
          15,
          new THREE.Vector3(10, 10, 10),
          hand_landmarks_dict
        );
        let i = 0;
        const gap_X = pose_left_wrist.x - hand_3d_landmarks["wrist"].x;
        const gap_Y = pose_left_wrist.y - hand_3d_landmarks["wrist"].y;
        const gap_Z = pose_left_wrist.z - hand_3d_landmarks["wrist"].z;
        for (const [key, value] of Object.entries(hand_3d_landmarks)) {
          value.x += gap_X;
          value.y += gap_Y;
          value.z += gap_Z;
          l_handlandmarks_points.geometry.attributes.position.array[3 * i + 0] =
            value.x;
          l_handlandmarks_points.geometry.attributes.position.array[3 * i + 1] =
            value.y;
          l_handlandmarks_points.geometry.attributes.position.array[3 * i + 2] =
            value.z;
          i++;
        }
        l_handlandmarks_points.geometry.attributes.position.needsUpdate = true;
        const jointWrist = hand_3d_landmarks["wrist"];
        const jointIndex_mcp = hand_3d_landmarks["index_finger_mcp"];
        const jointMiddle_mcp = hand_3d_landmarks["middle_finger_mcp"];
        const jointPinky_mcp = hand_3d_landmarks["pinky_finger_mcp"];

        const boneHand = skeleton.getBoneByName("left wrist");
        const boneIndex1 = skeleton.getBoneByName("Left Finger 1");
        const boneMiddle1 = skeleton.getBoneByName("Left middle finger 1");
        const bonePinky1 = skeleton.getBoneByName("Left little finger 1");

        const v_middle = new THREE.Vector3().subVectors(
          jointMiddle_mcp,
          jointWrist
        );

        const v_hand_v = v_middle.clone().normalize();
        const v_hand_index2pinky = new THREE.Vector3()
          .subVectors(jointPinky_mcp, jointIndex_mcp)
          .normalize();
        const v_hand_w = new THREE.Vector3().crossVectors(
          v_hand_index2pinky,
          v_hand_v
        );
        const v_hand_u = new THREE.Vector3().crossVectors(v_hand_v, v_hand_w);
        const R_MPhand = new THREE.Matrix4().makeBasis(
          v_hand_u,
          v_hand_v,
          v_hand_w
        );

        const v_bonehand_v = boneMiddle1.clone().position.normalize();
        const v_bonehand_index2pinky = new THREE.Vector3()
          .subVectors(bonePinky1.position, boneIndex1.position)
          .normalize();
        const v_bonehand_w = new THREE.Vector3().crossVectors(
          v_bonehand_index2pinky,
          v_bonehand_v
        );
        const v_bonehand_u = new THREE.Vector3().crossVectors(
          v_bonehand_v,
          v_bonehand_w
        );
        const R_Modelhand = new THREE.Matrix4().makeBasis(
          v_bonehand_u,
          v_bonehand_v,
          v_bonehand_w
        );

        const R_BonetoMP = R_MPhand.clone().multiply(
          R_Modelhand.clone().transpose()
        );
        const R_toTpose = R_chain_leftupper.clone().transpose();
        const R_wrist = R_BonetoMP.clone().premultiply(R_toTpose);
        boneHand.quaternion.setFromRotationMatrix(R_wrist);

        R_chain_leftupper.multiply(
          new THREE.Matrix4().extractRotation(boneHand.matrix)
        );
        let R_chain_index = new THREE.Matrix4().identity();
        let R_chain_middle = new THREE.Matrix4().identity();
        let R_chain_ring = new THREE.Matrix4().identity();
        let R_chain_pinky = new THREE.Matrix4().identity();
        let R_chain_thumb = new THREE.Matrix4().identity();

        let R_list = [
          R_chain_index,
          R_chain_middle,
          R_chain_ring,
          R_chain_pinky,
          R_chain_thumb,
        ];

        for (i = 0; i < 5; i++) {
          R_list[i].multiply(R_chain_leftupper);
        }

        for (i = 0; i < 12; i++) {
          let bone_list = [
            "index",
            "middle",
            "ring",
            "pinky",
            "Finger ",
            "middle finger ",
            "ring finger ",
            "little finger ",
          ];
          let bone_point_list = ["mcp", "pip", "dip", "tip"];
          let remainder = i % 3;
          let quotient = parseInt(i / 3);
          let finger = bone_list[quotient];
          let finger_point = finger + "_finger_" + bone_point_list[remainder];
          let next_point = finger + "_finger_" + bone_point_list[remainder + 1];
          //
          let Bone = "Left " + bone_list[quotient + 4] + (remainder + 1);
          let next_Bone = "Left " + bone_list[quotient + 4] + (remainder + 2);
          let R = R_list[quotient];
          SetRbyCalculatingJoints(
            hand_3d_landmarks[finger_point],
            hand_3d_landmarks[next_point],
            skeleton.getBoneByName(Bone),
            skeleton.getBoneByName(next_Bone),
            R
          );
        }
        SetRbyCalculatingJoints(
          hand_3d_landmarks["thumb_finger_pip"],
          hand_3d_landmarks["thumb_finger_dip"],
          skeleton.getBoneByName("Left thumb 2"),
          skeleton.getBoneByName("Left thumb 3"),
          R_chain_thumb
        );
        SetRbyCalculatingJoints(
          hand_3d_landmarks["thumb_finger_dip"],
          hand_3d_landmarks["thumb_finger_tip"],
          skeleton.getBoneByName("Left thumb 3"),
          skeleton.getBoneByName("Left thumb 4"),
          R_chain_thumb
        );
      }

      if (results.rightHandLandmarks) {
        let hand_landmarks_dict = {};
        results.rightHandLandmarks.forEach((landmark, i) => {
          hand_landmarks_dict[index_to_name_hands[i]] = landmark;
        });
        let hand_3d_landmarks = update3dpose(
          camera_world,
          15,
          new THREE.Vector3(10, 10, 10),
          hand_landmarks_dict
        );
        let i = 0;
        const gap_X = pose_right_wrist.x - hand_3d_landmarks["wrist"].x;
        const gap_Y = pose_right_wrist.y - hand_3d_landmarks["wrist"].y;
        const gap_Z = pose_right_wrist.z - hand_3d_landmarks["wrist"].z;
        for (const [key, value] of Object.entries(hand_3d_landmarks)) {
          value.x += gap_X;
          value.y += gap_Y;
          value.z += gap_Z;
          r_handlandmarks_points.geometry.attributes.position.array[3 * i + 0] =
            value.x;
          r_handlandmarks_points.geometry.attributes.position.array[3 * i + 1] =
            value.y;
          r_handlandmarks_points.geometry.attributes.position.array[3 * i + 2] =
            value.z;
          i++;
        }
        r_handlandmarks_points.geometry.attributes.position.needsUpdate = true;
        const jointWrist = hand_3d_landmarks["wrist"];
        const jointIndex_mcp = hand_3d_landmarks["index_finger_mcp"];
        const jointMiddle_mcp = hand_3d_landmarks["middle_finger_mcp"];
        const jointPinky_mcp = hand_3d_landmarks["pinky_finger_mcp"];

        const boneHand = skeleton.getBoneByName("right wrist");
        const boneIndex1 = skeleton.getBoneByName("Right Finger 1");
        const boneMiddle1 = skeleton.getBoneByName("Right middle finger 1");
        const bonePinky1 = skeleton.getBoneByName("Right little finger 1");

        const v_middle = new THREE.Vector3().subVectors(
          jointMiddle_mcp,
          jointWrist
        );

        const v_hand_v = v_middle.clone().normalize();
        const v_hand_index2pinky = new THREE.Vector3()
          .subVectors(jointPinky_mcp, jointIndex_mcp)
          .normalize();
        const v_hand_w = new THREE.Vector3().crossVectors(
          v_hand_index2pinky,
          v_hand_v
        );
        const v_hand_u = new THREE.Vector3().crossVectors(v_hand_v, v_hand_w);
        const R_MPhand = new THREE.Matrix4().makeBasis(
          v_hand_u,
          v_hand_v,
          v_hand_w
        );

        const v_bonehand_v = boneMiddle1.clone().position.normalize();
        const v_bonehand_index2pinky = new THREE.Vector3()
          .subVectors(bonePinky1.position, boneIndex1.position)
          .normalize();
        const v_bonehand_w = new THREE.Vector3().crossVectors(
          v_bonehand_index2pinky,
          v_bonehand_v
        );
        const v_bonehand_u = new THREE.Vector3().crossVectors(
          v_bonehand_v,
          v_bonehand_w
        );
        const R_Modelhand = new THREE.Matrix4().makeBasis(
          v_bonehand_u,
          v_bonehand_v,
          v_bonehand_w
        );

        const R_BonetoMP = R_MPhand.clone().multiply(
          R_Modelhand.clone().transpose()
        );
        const R_toTpose = R_chain_rightupper.clone().transpose();
        const R_wrist = R_BonetoMP.clone().premultiply(R_toTpose);
        boneHand.quaternion.setFromRotationMatrix(R_wrist);

        R_chain_rightupper.multiply(
          new THREE.Matrix4().extractRotation(boneHand.matrix)
        );
        let R_chain_index = new THREE.Matrix4().identity();
        let R_chain_middle = new THREE.Matrix4().identity();
        let R_chain_ring = new THREE.Matrix4().identity();
        let R_chain_pinky = new THREE.Matrix4().identity();
        let R_chain_thumb = new THREE.Matrix4().identity();

        let R_list = [
          R_chain_index,
          R_chain_middle,
          R_chain_ring,
          R_chain_pinky,
          R_chain_thumb,
        ];

        for (i = 0; i < 5; i++) {
          R_list[i].multiply(R_chain_rightupper);
        }

        for (i = 0; i < 12; i++) {
          let bone_list = [
            "index",
            "middle",
            "ring",
            "pinky",
            "Finger ",
            "middle finger ",
            "ring finger ",
            "little finger ",
          ];
          let bone_point_list = ["mcp", "pip", "dip", "tip"];
          let remainder = i % 3;
          let quotient = parseInt(i / 3);
          let finger = bone_list[quotient];
          let finger_point = finger + "_finger_" + bone_point_list[remainder];
          let next_point = finger + "_finger_" + bone_point_list[remainder + 1];
          let Bone = "Right " + bone_list[quotient + 4] + (remainder + 1);
          let next_Bone = "Right " + bone_list[quotient + 4] + (remainder + 2);
          let R = R_list[quotient];
          SetRbyCalculatingJoints(
            hand_3d_landmarks[finger_point],
            hand_3d_landmarks[next_point],
            skeleton.getBoneByName(Bone),
            skeleton.getBoneByName(next_Bone),
            R
          );
        }
        SetRbyCalculatingJoints(
          hand_3d_landmarks["thumb_finger_pip"],
          hand_3d_landmarks["thumb_finger_dip"],
          skeleton.getBoneByName("Right thumb 2"),
          skeleton.getBoneByName("Right thumb 3"),
          R_chain_thumb
        );
        SetRbyCalculatingJoints(
          hand_3d_landmarks["thumb_finger_dip"],
          hand_3d_landmarks["thumb_finger_tip"],
          skeleton.getBoneByName("Right thumb 3"),
          skeleton.getBoneByName("Right thumb 4"),
          R_chain_thumb
        );
      }
    }
    helper.update(clock.getDelta());
    effect.render(scene, camera_ar);
    stats.end();
    canvasCtx.restore();
  }

  function initGui() {
    const api = {
      animation: true,
      ik: true,
      outline: true,
      physics: true,
      "show IK bones": false,
      "show rigid bodies": false,
    };

    const gui = new GUI();

    gui.add(api, "animation").onChange(function () {
      if (bool_animation == true) bool_animation = false;
      else if (bool_animation == false) bool_animation = true;
    });

    gui.add(api, "ik").onChange(function () {
      helper.enable("ik", api["ik"]);
    });

    gui.add(api, "outline").onChange(function () {
      effect.enabled = api["outline"];
    });

    gui.add(api, "physics").onChange(function () {
      helper.enable("physics", api["physics"]);
    });

    gui.add(api, "show IK bones").onChange(function () {
      ikHelper.visible = api["show IK bones"];
    });

    gui.add(api, "show rigid bodies").onChange(function () {
      if (physicsHelper !== undefined)
        physicsHelper.visible = api["show rigid bodies"];
    });
  }
}

//
