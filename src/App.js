/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable default-case */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';

const SNAP_DISTANCE = 1.5;

const App = () => {
  const mountRef = useRef(null);
  const [rectangles, setRectangles] = useState([]);
  const [selectedRectangles, setSelectedRectangles] = useState([]);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const dragControlsRef = useRef(null);
  const linePoolRef = useRef([]);
  const activeSnapLinesRef = useRef({});

  useEffect(() => {
    const width = 800;
    const height = 600;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    sceneRef.current.userData.maxWidth = width;
    sceneRef.current.userData.maxHeight = height;

    const camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);
    camera.position.z = 10;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.enableZoom = false;
    controlsRef.current = controls;

    const polygonShape = new THREE.Shape();
    polygonShape.moveTo(-width / 2, -height / 2);
    polygonShape.lineTo(width / 2, -height / 2);
    polygonShape.lineTo(width / 2, height / 2);
    polygonShape.lineTo(-width / 2, height / 2);

    const polygonGeometry = new THREE.ShapeGeometry(polygonShape);
    const polygonMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
    const polygonMesh = new THREE.Mesh(polygonGeometry, polygonMaterial);

    scene.add(polygonMesh);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    dragControlsRef.current = new DragControls(rectangles, cameraRef.current, rendererRef.current.domElement);

    dragControlsRef.current.addEventListener('dragstart', event => {
      event.object.material.transparent = true;
      event.object.material.opacity = 0.5;
    });

    dragControlsRef.current.addEventListener('drag', event => {
      const draggedRect = event.object;
      updateSnapLines(draggedRect);
    });

    dragControlsRef.current.addEventListener('dragend', event => {
      event.object.material.transparent = false;
      event.object.material.opacity = 1;
      hideSnapLines();
    });

    return () => {
      dragControlsRef.current.dispose();
    };
  }, [rectangles]);

  const getLineFromPool = () => {
    let line;
    if (linePoolRef.current.length > 0) {
      line = linePoolRef.current.pop();
      console.log('Reusing line from pool');
    } else {
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      line = new THREE.Line(lineGeometry, lineMaterial);
      sceneRef.current.add(line);
      console.log('Created new line and added to scene');
    }
    line.visible = true;
    return line;
  };

  const returnLineToPool = line => {
    line.visible = false;
    linePoolRef.current.push(line);
  };

  const hideSnapLines = () => {
    sceneRef.current.children.forEach(child => {
      if (child.type === 'Line') {
        child.visible = false;
        returnLineToPool(child);
      }
    });
    activeSnapLinesRef.current = {};
  };

  const updateSnapLines = draggedRectangle => {
    hideSnapLines();

    const draggedBounds = new THREE.Box3().setFromObject(draggedRectangle);

    rectangles.forEach(rectangle => {
      if (rectangle !== draggedRectangle) {
        const targetBounds = new THREE.Box3().setFromObject(rectangle);

        checkAndCreateSnapLine('left', draggedBounds, targetBounds);
        checkAndCreateSnapLine('right', draggedBounds, targetBounds);
        checkAndCreateSnapLine('top', draggedBounds, targetBounds);
        checkAndCreateSnapLine('bottom', draggedBounds, targetBounds);
        checkAndCreateSnapLine('bottomLeft', draggedBounds, targetBounds);
        checkAndCreateSnapLine('topLeft', draggedBounds, targetBounds);
        checkAndCreateSnapLine('bottomRight', draggedBounds, targetBounds);
        checkAndCreateSnapLine('topRight', draggedBounds, targetBounds);
      }
    });
  };

  const checkAndCreateSnapLine = (direction, draggedBounds, targetBounds) => {
    let shouldShow = false;
    let start, end;

    switch (direction) {
      case 'left':
        shouldShow = Math.abs(draggedBounds.min.x - targetBounds.min.x) < SNAP_DISTANCE;
        if (shouldShow) {
          start = new THREE.Vector3(targetBounds.min.x, Math.min(targetBounds.min.y, draggedBounds.min.y), 0);
          end = new THREE.Vector3(targetBounds.min.x, Math.max(targetBounds.max.y, draggedBounds.max.y), 0);
        }
        break;
      case 'right':
        shouldShow = Math.abs(draggedBounds.max.x - targetBounds.max.x) < SNAP_DISTANCE;
        if (shouldShow) {
          start = new THREE.Vector3(targetBounds.max.x, Math.min(targetBounds.min.y, draggedBounds.min.y), 0);
          end = new THREE.Vector3(targetBounds.max.x, Math.max(targetBounds.max.y, draggedBounds.max.y), 0);
        }
        break;
      case 'top':
        shouldShow = Math.abs(draggedBounds.max.y - targetBounds.max.y) < SNAP_DISTANCE;
        if (shouldShow) {
          start = new THREE.Vector3(Math.min(targetBounds.min.x, draggedBounds.min.x), targetBounds.max.y, 0);
          end = new THREE.Vector3(Math.max(targetBounds.max.x, draggedBounds.max.x), targetBounds.max.y, 0);
        }
        break;
      case 'bottom':
        shouldShow = Math.abs(draggedBounds.min.y - targetBounds.min.y) < SNAP_DISTANCE;
        if (shouldShow) {
          start = new THREE.Vector3(Math.min(targetBounds.min.x, draggedBounds.min.x), targetBounds.min.y, 0);
          end = new THREE.Vector3(Math.max(targetBounds.max.x, draggedBounds.max.x), targetBounds.min.y, 0);
        }
        break;
      case 'bottomLeft':
        shouldShow = (draggedBounds.min.x - targetBounds.max.x < SNAP_DISTANCE && draggedBounds.min.x - targetBounds.max.x > 0) || (draggedBounds.min.y - targetBounds.max.y < SNAP_DISTANCE && draggedBounds.min.y - targetBounds.max.y > 0);
        if (shouldShow) {
          start = new THREE.Vector3(targetBounds.max.x, targetBounds.max.y, 0);
          end = new THREE.Vector3(draggedBounds.min.x, draggedBounds.min.y, 0);
        }
        break;
      case 'topLeft':
        shouldShow = (draggedBounds.min.x - targetBounds.max.x < SNAP_DISTANCE && draggedBounds.min.x - targetBounds.max.x > 0) || (targetBounds.min.y - draggedBounds.max.y < SNAP_DISTANCE && targetBounds.min.y - draggedBounds.max.y > 0);
        if (shouldShow) {
          start = new THREE.Vector3(targetBounds.max.x, targetBounds.min.y, 0);
          end = new THREE.Vector3(draggedBounds.min.x, draggedBounds.max.y, 0);
        }
        break;
      case 'bottomRight':
        shouldShow = (targetBounds.min.x - draggedBounds.max.x < SNAP_DISTANCE && targetBounds.min.x - draggedBounds.max.x > 0) || (draggedBounds.min.y - targetBounds.max.y < SNAP_DISTANCE && draggedBounds.min.y - targetBounds.max.y > 0);
        if (shouldShow) {
          start = new THREE.Vector3(draggedBounds.max.x, draggedBounds.min.y, 0);
          end = new THREE.Vector3(targetBounds.min.x, targetBounds.max.y, 0);
        }
        break;
      case 'topRight':
        shouldShow = (targetBounds.min.x - draggedBounds.max.x < SNAP_DISTANCE && targetBounds.min.x - draggedBounds.max.x > 0) || (targetBounds.min.y - draggedBounds.max.y < SNAP_DISTANCE && targetBounds.min.y - draggedBounds.max.y > 0);
        if (shouldShow) {
          start = new THREE.Vector3(draggedBounds.max.x, draggedBounds.max.y, 0);
          end = new THREE.Vector3(targetBounds.min.x, targetBounds.min.y, 0);
        }
        break;
    }

    if (shouldShow) {
      console.log(`Creating snap line for ${direction}`);
      const line = getLineFromPool();
      line.geometry.setFromPoints([start, end]);
      line.geometry.attributes.position.needsUpdate = true;
      line.visible = true;
      activeSnapLinesRef.current[direction] = line;
      console.log(`Snap line created: visible = ${line.visible}, in scene = ${sceneRef.current.children.includes(line)}`);
    } else {
      console.log(`No snap line needed for ${direction}`);
    }
  };

  const addRectangle = () => {
    const width = 100;
    const height = 50;

    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    const rectangle = new THREE.Mesh(geometry, material);

    rectangle.userData.isVertical = false;

    const padding = 10;

    let positionFound = false;

    let x = -sceneRef.current.userData.maxWidth / 2;
    let y = sceneRef.current.userData.maxHeight / 2;

    while (!positionFound) {
      rectangle.position.set(x + width / 2, y - height / 2, 0);

      const newBox = new THREE.Box3().setFromObject(rectangle);

      positionFound = !rectangles.some(rectangle => {
        const existingBox = new THREE.Box3().setFromObject(rectangle);
        return existingBox.intersectsBox(newBox);
      });

      if (!positionFound) {
        x += width + padding;
        if (x + width > sceneRef.current.userData.maxWidth / 2) {
          x = -sceneRef.current.userData.maxWidth / 2;
          y -= height + padding;
        }
      }
    }

    sceneRef.current.add(rectangle);
    setRectangles([...rectangles, rectangle]);
  };

  const deleteSelectedRectangles = () => {
    const remainingRectangles = rectangles.filter(rect => !selectedRectangles.includes(rect));
    setRectangles(remainingRectangles);
    setSelectedRectangles([]);
    selectedRectangles.forEach(rect => {
      sceneRef.current.remove(rect);
    });
  };

  const onClick = event => {
    if (event.altKey) {
      const rect = event.target.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(rectangles);
      if (intersects.length > 0) {
        const clickedRect = intersects[0].object;
        const selectedRectangle = selectedRectangles.filter(rectangle => rectangle.uuid === clickedRect.uuid);
        if (selectedRectangle.length === 0) {
          setSelectedRectangles([...selectedRectangles, clickedRect]);
          clickedRect.material.transparent = true;
          clickedRect.material.opacity = 0.5;
        } else {
          setSelectedRectangles(selectedRectangles.filter(rectangle => rectangle !== clickedRect));
          clickedRect.material.transparent = false;
          clickedRect.material.opacity = 1;
        }
      }
    }
  };

  const onDoubleClick = event => {
    const rect = event.target.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(rectangles);
    if (intersects.length > 0) {
      const clickedRect = intersects[0].object;
      clickedRect.userData.isVertical = !clickedRect.userData.isVertical;
      if (clickedRect.userData.isVertical) {
        clickedRect.rotation.z = Math.PI / 2;
      } else {
        clickedRect.rotation.z = 0;
      }
    }
  };

  const rotateSelectedRectangles = () => {
    selectedRectangles.forEach(rect => {
      rect.rotation.z += Math.PI / 4;
    });
  };

  const scaleSelectedRectangles = scale => {
    selectedRectangles.forEach(rect => {
      rect.scale.set(scale, scale, 1);
    });
  };

  return (
    <div>
      <div ref={mountRef} onClick={onClick} onDoubleClick={onDoubleClick} />
      <button onClick={addRectangle}>Add Rectangle</button>
      <button onClick={deleteSelectedRectangles}>Delete Selected Rectangles (Alt)</button>
      <button onClick={rotateSelectedRectangles}>Rotate Selected</button>
      <button onClick={() => scaleSelectedRectangles(1.1)}>Scale Up</button>
      <button onClick={() => scaleSelectedRectangles(0.9)}>Scale Down</button>
    </div>
  );
};

export default App;
