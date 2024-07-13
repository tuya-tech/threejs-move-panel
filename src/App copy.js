import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';

const SNAP_DISTANCE = 1.5;

const DIRECTIONS = ['left', 'right', 'top', 'bottom', 'bottomLeft', 'topLeft', 'bottomRight', 'topRight'];

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
  const snapLinesRef = useRef({ left: null, right: null, top: null, bottom: null, bottomLeft: null, topLeft: null, bottomRight: null, topRight: null });
  const dragControlsRef = useRef(null);

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

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });

    DIRECTIONS.forEach(direction => {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.visible = false;
      scene.add(line);
      snapLinesRef.current[direction] = line;
    });

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
    console.log(rectangles);
    setRectangles([...rectangles, rectangle]);
  };

  const animate = () => {
    requestAnimationFrame(animate);
    controlsRef.current.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  };

  const deleteSelectedRectangles = () => {
    const remainingRectangles = rectangles.filter(rect => !selectedRectangles.includes(rect));
    setRectangles(remainingRectangles);
    setSelectedRectangles([]);
    selectedRectangles.forEach(rect => {
      sceneRef.current.remove(rect);
    });
    animate();
  };

  const onClick = event => {
    if (event.ctrlKey) {
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

  const updateSnapLines = draggedRectangle => {
    const draggedBounds = new THREE.Box3().setFromObject(draggedRectangle);

    rectangles.forEach(rectangle => {
      if (rectangle !== draggedRectangle) {
        const targetBounds = new THREE.Box3().setFromObject(rectangle);

        if (Math.abs(draggedBounds.min.x - targetBounds.min.x) < SNAP_DISTANCE) {
          showOrHideSnapLine('left', true, targetBounds, draggedBounds);
          showOrHideSnapLine('left', true, draggedBounds, targetBounds);
        } else {
          showOrHideSnapLine('left', false, targetBounds, draggedBounds);
        }

        if (Math.abs(draggedBounds.max.x - targetBounds.max.x) < SNAP_DISTANCE) {
          showOrHideSnapLine('right', true, targetBounds, draggedBounds);
          showOrHideSnapLine('right', true, draggedBounds, targetBounds);
        } else {
          showOrHideSnapLine('right', false, targetBounds, draggedBounds);
          showOrHideSnapLine('right', false, draggedBounds, targetBounds);
        }

        if (Math.abs(draggedBounds.min.y - targetBounds.min.y) < SNAP_DISTANCE) {
          showOrHideSnapLine('bottom', true, targetBounds, draggedBounds);
          showOrHideSnapLine('bottom', true, draggedBounds, targetBounds);
        } else {
          showOrHideSnapLine('bottom', false, targetBounds, draggedBounds);
          showOrHideSnapLine('bottom', false, draggedBounds, targetBounds);
        }

        if (Math.abs(draggedBounds.max.y - targetBounds.max.y) < SNAP_DISTANCE) {
          showOrHideSnapLine('top', true, targetBounds, draggedBounds);
          showOrHideSnapLine('top', true, draggedBounds, targetBounds);
        } else {
          showOrHideSnapLine('top', false, targetBounds, draggedBounds);
          showOrHideSnapLine('top', false, draggedBounds, targetBounds);
        }

        if (draggedBounds.min.x - targetBounds.max.x > 0 && draggedBounds.min.y - targetBounds.max.y > 0) {
          let bottomLeftFlag = true;
          if (draggedBounds.min.x - targetBounds.max.x < SNAP_DISTANCE) {
            bottomLeftFlag = false;
            showOrHideSnapLine('bottomLeft', true, targetBounds, draggedBounds, false);
          } else {
            showOrHideSnapLine('bottomLeft', false, targetBounds, draggedBounds, false);
          }
          if (draggedBounds.min.y - targetBounds.max.y < SNAP_DISTANCE) {
            showOrHideSnapLine('bottomLeft', true, targetBounds, draggedBounds, true);
          } else if (bottomLeftFlag) {
            showOrHideSnapLine('bottomLeft', false, targetBounds, draggedBounds, true);
          }
        } else {
          showOrHideSnapLine('bottomLeft', false, targetBounds, draggedBounds, false);
        }

        if (targetBounds.min.x - draggedBounds.max.x > 0 && draggedBounds.min.y - targetBounds.max.y > 0) {
          let flag = true;
          if (targetBounds.min.x - draggedBounds.max.x < SNAP_DISTANCE) {
            flag = false;
            showOrHideSnapLine('bottomRight', true, targetBounds, draggedBounds, false);
          } else {
            showOrHideSnapLine('bottomRight', false, targetBounds, draggedBounds, false);
          }
          if (draggedBounds.min.y - targetBounds.max.y < SNAP_DISTANCE) {
            showOrHideSnapLine('bottomRight', true, targetBounds, draggedBounds, true);
          } else if (flag) {
            showOrHideSnapLine('bottomRight', false, targetBounds, draggedBounds, true);
          }
        } else {
          showOrHideSnapLine('bottomRight', false, targetBounds, draggedBounds, false);
        }

        if (targetBounds.min.x - draggedBounds.max.x > 0 && targetBounds.min.y - draggedBounds.max.y > 0) {
          let flag = true;
          if (targetBounds.min.x - draggedBounds.max.x < SNAP_DISTANCE) {
            flag = false;
            showOrHideSnapLine('topRight', true, targetBounds, draggedBounds, false);
          } else {
            showOrHideSnapLine('topRight', false, targetBounds, draggedBounds, false);
          }
          if (targetBounds.min.y - draggedBounds.max.y < SNAP_DISTANCE) {
            showOrHideSnapLine('topRight', true, targetBounds, draggedBounds, true);
          } else if (flag) {
            showOrHideSnapLine('topRight', false, targetBounds, draggedBounds, true);
          }
        } else {
          showOrHideSnapLine('topRight', false, targetBounds, draggedBounds, false);
        }

        if (draggedBounds.min.x - targetBounds.max.x > 0 && targetBounds.min.y - draggedBounds.max.y > 0) {
          let flag = true;
          if (draggedBounds.min.x - targetBounds.max.x < SNAP_DISTANCE) {
            flag = false;
            showOrHideSnapLine('topLeft', true, targetBounds, draggedBounds, false);
          } else {
            showOrHideSnapLine('topLeft', false, targetBounds, draggedBounds, false);
          }
          if (targetBounds.min.y - draggedBounds.max.y < SNAP_DISTANCE) {
            showOrHideSnapLine('topLeft', true, targetBounds, draggedBounds, true);
          } else if (flag) {
            showOrHideSnapLine('topLeft', false, targetBounds, draggedBounds, true);
          }
        } else {
          showOrHideSnapLine('topLeft', false, targetBounds, draggedBounds, false);
        }
      }
    });
  };

  const showOrHideSnapLine = (direction, isVisible, targetBounds, draggedBounds, xAxis = null) => {
    const line = snapLinesRef.current[direction];
    if (line) {
      if (direction === 'left') {
        const x = targetBounds.min.x;
        line.geometry.setFromPoints([new THREE.Vector3(x, Math.min(targetBounds.min.y, draggedBounds.min.y), 0), new THREE.Vector3(x, Math.max(targetBounds.max.y, draggedBounds.max.y), 0)]);
      } else if (direction === 'right') {
        const x = targetBounds.max.x;
        line.geometry.setFromPoints([new THREE.Vector3(x, Math.min(targetBounds.min.y, draggedBounds.min.y), 0), new THREE.Vector3(x, Math.max(targetBounds.max.y, draggedBounds.max.y), 0)]);
      } else if (direction === 'top') {
        const y = targetBounds.max.y;
        line.geometry.setFromPoints([new THREE.Vector3(Math.min(targetBounds.min.x, draggedBounds.min.x), y, 0), new THREE.Vector3(Math.max(targetBounds.max.x, draggedBounds.max.x), y, 0)]);
      } else if (direction === 'bottom') {
        const y = targetBounds.min.y;
        line.geometry.setFromPoints([new THREE.Vector3(Math.min(targetBounds.min.x, draggedBounds.min.x), y, 0), new THREE.Vector3(Math.max(targetBounds.max.x, draggedBounds.max.x), y, 0)]);
      } else if (direction === 'bottomLeft') {
        if (xAxis) {
          line.geometry.setFromPoints([new THREE.Vector3(targetBounds.min.x, targetBounds.max.y, 0), new THREE.Vector3(draggedBounds.max.x, draggedBounds.min.y, 0)]);
        } else {
          line.geometry.setFromPoints([new THREE.Vector3(targetBounds.max.x, targetBounds.min.y, 0), new THREE.Vector3(draggedBounds.min.x, draggedBounds.max.y, 0)]);
        }
      } else if (direction === 'topLeft') {
        if (xAxis) {
          line.geometry.setFromPoints([new THREE.Vector3(targetBounds.min.x, targetBounds.min.y, 0), new THREE.Vector3(draggedBounds.max.x, draggedBounds.max.y, 0)]);
        } else {
          line.geometry.setFromPoints([new THREE.Vector3(targetBounds.max.x, targetBounds.max.y, 0), new THREE.Vector3(draggedBounds.min.x, draggedBounds.min.y, 0)]);
        }
      } else if (direction === 'bottomRight') {
        if (xAxis) {
          line.geometry.setFromPoints([new THREE.Vector3(draggedBounds.min.x, draggedBounds.min.y, 0), new THREE.Vector3(targetBounds.max.x, targetBounds.max.y, 0)]);
        } else {
          line.geometry.setFromPoints([new THREE.Vector3(draggedBounds.max.x, draggedBounds.max.y, 0), new THREE.Vector3(targetBounds.min.x, targetBounds.min.y, 0)]);
        }
      } else if (direction === 'topRight') {
        if (xAxis) {
          line.geometry.setFromPoints([new THREE.Vector3(draggedBounds.min.x, draggedBounds.max.y, 0), new THREE.Vector3(targetBounds.max.x, targetBounds.min.y, 0)]);
        } else {
          line.geometry.setFromPoints([new THREE.Vector3(draggedBounds.max.x, draggedBounds.min.y, 0), new THREE.Vector3(targetBounds.min.x, targetBounds.max.y, 0)]);
        }
      }
      line.geometry.attributes.position.needsUpdate = true;
      line.renderOrder = 1;
      line.visible = isVisible;
    } else {
      console.error(`Snap line ${direction} is not defined in snapLinesRef.`);
    }
  };

  const hideSnapLines = () => Object.values(snapLinesRef.current).forEach(line => (line.visible = false));

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
      <button onClick={deleteSelectedRectangles}>Delete Selected Rectangles (Ctrl)</button>
      <button onClick={rotateSelectedRectangles}>Rotate Selected</button>
      <button onClick={() => scaleSelectedRectangles(1.1)}>Scale Up</button>
      <button onClick={() => scaleSelectedRectangles(0.9)}>Scale Down</button>
    </div>
  );
};

export default App;
