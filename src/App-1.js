import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';

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

    ['left', 'right', 'top', 'bottom', 'bottomLeft', 'topLeft', 'bottomRight', 'topRight'].forEach(direction => {
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
      rectangles.forEach(rectangle => {
        if (rectangle === draggedRect) return;
        var firstRec = new THREE.Box3().setFromObject(rectangle);
        var secondRec = new THREE.Box3().setFromObject(draggedRect);
        var collision = firstRec.intersectsBox(secondRec);
        if (collision) {
          // dragControlsRef.current.enabled = false;
        }
      });
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
    const mesh = new THREE.Mesh(geometry, material);

    mesh.userData.isVertical = false;

    const padding = 10;

    let positionFound = false;

    let x = -sceneRef.current.userData.maxWidth / 2;
    let y = sceneRef.current.userData.maxHeight / 2;

    while (!positionFound) {
      mesh.position.set(x + width / 2, y - height / 2, 0);

      const newBox = new THREE.Box3().setFromObject(mesh);

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

    sceneRef.current.add(mesh);
    setRectangles([...rectangles, mesh]);
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
    const edgeSnapDistance = 0.5;

    const cornerSnapDistance = 1.0;

    const draggedBounds = new THREE.Box3().setFromObject(draggedRectangle);

    rectangles.forEach(rectangle => {
      if (rectangle !== draggedRectangle) {
        const rectBounds = new THREE.Box3().setFromObject(rectangle);

        // Vertical snap
        if (Math.abs(draggedBounds.min.x - rectBounds.min.x) < edgeSnapDistance) {
          showOrHideSnapLine('left', true, rectBounds, draggedBounds);
          showOrHideSnapLine('left', true, draggedBounds, rectBounds);
        } else {
          showOrHideSnapLine('left', false, rectBounds, draggedBounds);
          showOrHideSnapLine('left', false, draggedBounds, rectBounds);
        }

        if (Math.abs(draggedBounds.max.x - rectBounds.max.x) < edgeSnapDistance) {
          showOrHideSnapLine('right', true, rectBounds, draggedBounds);
          showOrHideSnapLine('right', true, draggedBounds, rectBounds);
        } else {
          showOrHideSnapLine('right', false, rectBounds, draggedBounds);
          showOrHideSnapLine('right', false, draggedBounds, rectBounds);
        }

        // Horizontal snap
        if (Math.abs(draggedBounds.min.y - rectBounds.min.y) < edgeSnapDistance) {
          showOrHideSnapLine('bottom', true, rectBounds, draggedBounds);
          showOrHideSnapLine('bottom', true, draggedBounds, rectBounds);
        } else {
          showOrHideSnapLine('bottom', false, rectBounds, draggedBounds);
          showOrHideSnapLine('bottom', false, draggedBounds, rectBounds);
        }

        if (Math.abs(draggedBounds.max.y - rectBounds.max.y) < edgeSnapDistance) {
          showOrHideSnapLine('top', true, rectBounds, draggedBounds);
          showOrHideSnapLine('top', true, draggedBounds, rectBounds);
        } else {
          showOrHideSnapLine('top', false, rectBounds, draggedBounds);
          showOrHideSnapLine('top', false, draggedBounds, rectBounds);
        }

        // Bottom left corner
        if (Math.abs(draggedBounds.min.x - rectBounds.min.x) < cornerSnapDistance && Math.abs(draggedBounds.min.y - rectBounds.min.y) < cornerSnapDistance) {
          showOrHideSnapLine('bottomLeft', true, rectBounds, draggedBounds);
        } else {
          showOrHideSnapLine('bottomLeft', false, rectBounds, draggedBounds);
        }

        // Top left corner
        if (Math.abs(draggedBounds.min.x - rectBounds.min.x) < cornerSnapDistance && Math.abs(draggedBounds.max.y - rectBounds.max.y) < cornerSnapDistance) {
          showOrHideSnapLine('topLeft', true, rectBounds, draggedBounds);
        } else {
          showOrHideSnapLine('topLeft', false, rectBounds, draggedBounds);
        }

        // Bottom right corner
        if (Math.abs(draggedBounds.max.x - rectBounds.max.x) < cornerSnapDistance && Math.abs(draggedBounds.min.y - rectBounds.min.y) < cornerSnapDistance) {
          showOrHideSnapLine('bottomRight', true, rectBounds, draggedBounds);
        } else {
          showOrHideSnapLine('bottomRight', false, rectBounds, draggedBounds);
        }

        // Top right corner
        if (Math.abs(draggedBounds.max.x - rectBounds.max.x) < cornerSnapDistance && Math.abs(draggedBounds.max.y - rectBounds.max.y) < cornerSnapDistance) {
          showOrHideSnapLine('topRight', true, rectBounds, draggedBounds);
        } else {
          showOrHideSnapLine('topRight', false, rectBounds, draggedBounds);
        }
      }
    });
  };

  const showOrHideSnapLine = (direction, isVisible, targetBounds, draggedBounds) => {
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
        const x = Math.min(targetBounds.min.x, draggedBounds.min.x);
        const y = Math.min(targetBounds.min.y, draggedBounds.min.y);
        line.geometry.setFromPoints([new THREE.Vector3(x, y, 0), new THREE.Vector3(x + 1, y, 0)]);
      } else if (direction === 'topLeft') {
        const x = Math.min(targetBounds.min.x, draggedBounds.min.x);
        const y = Math.max(targetBounds.max.y, draggedBounds.max.y);
        line.geometry.setFromPoints([new THREE.Vector3(x, y, 0), new THREE.Vector3(x + 1, y, 0)]);
      } else if (direction === 'bottomRight') {
        const x = Math.max(targetBounds.max.x, draggedBounds.max.x);
        const y = Math.min(targetBounds.min.y, draggedBounds.min.y);
        line.geometry.setFromPoints([new THREE.Vector3(x, y, 0), new THREE.Vector3(x + 1, y, 0)]);
      } else if (direction === 'topRight') {
        const x = Math.max(targetBounds.max.x, draggedBounds.max.x);
        const y = Math.max(targetBounds.max.y, draggedBounds.max.y);
        line.geometry.setFromPoints([new THREE.Vector3(x, y, 0), new THREE.Vector3(x + 1, y, 0)]);
      }
      line.geometry.attributes.position.needsUpdate = true;
      line.renderOrder = 1;
      line.visible = isVisible;
    } else {
      console.error(`Snap line ${direction} is not defined in snapLinesRef.`);
    }
  };

  const hideSnapLines = () => {
    Object.values(snapLinesRef.current).forEach(line => (line.visible = false));
  };

  return (
    <div>
      <div ref={mountRef} onClick={onClick} onDoubleClick={onDoubleClick} />
      <button onClick={addRectangle}>Add Rectangle</button>
      <button onClick={deleteSelectedRectangles}>Delete Selected Rectangles (Ctrl)</button>
    </div>
  );
};

export default App;
