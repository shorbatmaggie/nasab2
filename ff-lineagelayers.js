function _1(md) {
  return md`# Nasab2`;
}

function extractLineageLayers(selectedId, flatData) {
  const nodeById = Object.fromEntries(flatData.map(n => [n.id, n]));

  // --- Ancestors
  let ancestorLayers = [];
  let visitedA = new Set([selectedId]);
  let current = [selectedId];
  while (true) {
    let next = [];
    for (let id of current) {
      let node = nodeById[id];
      if (node && node.parents && node.parents.length) {
        for (let pid of node.parents) {
          if (!visitedA.has(pid)) {
            next.push(pid);
            visitedA.add(pid);
          }
        }
      }
    }
    if (!next.length) break;
    ancestorLayers.unshift(next.map(id => nodeById[id]).filter(Boolean));
    current = next;
  }

  // --- Descendants
  let descendantLayers = [];
  let visitedD = new Set([selectedId]);
  current = [selectedId];
  while (true) {
    let next = [];
    for (let node of flatData) {
      if ((node.parents || []).some(pid => current.includes(pid)) && !visitedD.has(node.id)) {
        next.push(node.id);
        visitedD.add(node.id);
      }
    }
    if (!next.length) break;
    descendantLayers.push(next.map(id => nodeById[id]).filter(Boolean));
    current = next;
  }

  // Combine: [ancestors..., [selected], descendants...]
  return [
    ...ancestorLayers,
    [nodeById[selectedId]],
    ...descendantLayers
  ];
}

function mergeLineageLayers(listOfLayerArrays) {
  // 1. Pad all so their "selected node" is at the same central index
  let preDepths = listOfLayerArrays.map(layers => layers.findIndex(arr => arr.length && arr[0].id));
  let maxPre = Math.max(...preDepths);
  let postDepths = listOfLayerArrays.map(layers => layers.length - 1 - preDepths[listOfLayerArrays.indexOf(layers)]);
  let maxPost = Math.max(...postDepths);

  let normalized = listOfLayerArrays.map((layers, i) => {
    let pre = maxPre - preDepths[i];
    let post = maxPost - postDepths[i];
    return [
      ...Array(pre).fill([]),
      ...layers,
      ...Array(post).fill([])
    ];
  });

  // 2. Merge by index, dedupe nodes by id
  let merged = [];
  let numLayers = normalized[0]?.length || 0;
  for (let i = 0; i < numLayers; ++i) {
    let allNodes = [];
    for (let lineage of normalized) {
      allNodes = allNodes.concat(lineage[i] || []);
    }
    // Deduplicate by id
    let seen = new Set();
    merged.push(allNodes.filter(n => {
      if (!n) return false;
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    }));
  }
  return merged;
}

function _dropdown(fullData, defaultLayers) {
  const flat = fullData;
  const sorted = [...flat].sort((a, b) => a.id.localeCompare(b.id, "en"));
  let layersList = [];
  let addedIds = new Set();

  // === DOM STRUCTURE ===

  const section = document.createElement("section");
  section.className = "p-4 bg-white text-[#588B8B] rounded-xl shadow";

  const title = document.createElement("h2");
  title.className = "text-xl font-bold mb-2";
  title.textContent = "Build a Multi-Lineage Visualization";

  // Dropdown
  const label = document.createElement("label");
  label.setAttribute("for", "lineage-select");
  label.className = "block font-semibold mb-1";
  label.textContent = "Select Text:";

  const select = document.createElement("select");
  select.id = "lineage-select";
  select.className = "w-full mb-4 p-2 border border-gray-300 rounded";
  select.style.backgroundColor = "#F5F5F5";
  // Add blank option
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = " Select a Text";
  select.appendChild(blank);

  // Add options
  for (const node of sorted) {
    const option = document.createElement("option");
    option.value = node.id;
    option.textContent = `${node.label} (${node.author}, d. ${node.death} AH)`;
    select.appendChild(option);
  }

  // Add Layer button
  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Layer";
  addBtn.className = "ml-2 px-4 py-2 rounded shadow";
  addBtn.style.backgroundColor = "#588B8B";
  addBtn.style.color = "white";

  // Added lineages display
  const addedDiv = document.createElement("div");
  addedDiv.className = "mt-4 flex flex-wrap gap-2";

  function renderAddedLineages() {
    addedDiv.innerHTML = "";
    if (!layersList.length) {
      addedDiv.innerHTML = `<span class="text-gray-400 italic">No layers added.</span>`;
      return;
    }
    layersList.forEach((layers, idx) => {
      // Get selected node's label for display
      let focal = layers.find(arr => arr.length && arr.some(n => n)).find(n => n);
      const badge = document.createElement("span");
      badge.className = "inline-flex items-center bg-[#588B8B] text-white px-3 py-1 rounded-full text-sm";
      badge.textContent = focal.label;
      // Remove X button
      const x = document.createElement("button");
      x.textContent = "×";
      x.className = "ml-2 bg-white text-[#588B8B] rounded-full px-2 py-0.5 border border-[#588B8B] text-xs";
      x.onclick = () => {
        // Remove from arrays, re-render
        addedIds.delete(focal.id);
        layersList.splice(idx, 1);
        if (layersList.length) {
          window.setFilteredData(mergeLineageLayers(layersList));
        } else {
          window.setFilteredData(window.defaultLayersCache);
        }
        renderAddedLineages();
      };
      badge.appendChild(x);
      addedDiv.appendChild(badge);
    });
  }

  addBtn.onclick = e => {
    e.preventDefault();
    const selectedID = select.value;
    if (!selectedID || addedIds.has(selectedID)) return; // Ignore if blank or already added
    const layers = extractLineageLayers(selectedID, flat);
    layersList.push(layers);
    addedIds.add(selectedID);
    window.setFilteredData(mergeLineageLayers(layersList));
    renderAddedLineages();
  };

  // --- Reset button
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset";
  resetBtn.className = "ml-2 px-4 py-2 rounded shadow";
  resetBtn.style.backgroundColor = "#588B8B";
  resetBtn.style.color = "white";
  resetBtn.onclick = () => {
    select.value = "";
    layersList = [];
    addedIds = new Set();
    window.setFilteredData(window.defaultLayersCache);
    renderAddedLineages();
  };

  // Initial render
  renderAddedLineages();

  section.append(title, label, select, addBtn, resetBtn, addedDiv);

  const outer = document.createElement("div");
  outer.className = "max-w-7xl mx-auto";
  outer.appendChild(section);

  const chartContainer = document.querySelector("#chart-area");
  chartContainer?.parentNode?.insertBefore(outer, chartContainer);

  return outer;
}


function _2(renderChart, data) {
  return (
    renderChart(data)
  )
}

function _3(md) { return (md`## Code`) } 

function _renderChart(color, constructTangleLayout, _, svg, background_color, d3) {
  return (
    (data, options = {}) => {
      options.color ||= (d, i) => color(i);
      const tangleLayout = constructTangleLayout(_.cloneDeep(data), options);

      const svgWidth = tangleLayout.layout.width;
      const svgHeight = tangleLayout.layout.height;
      const labelClearance = 10;

      // Container setup
      const container = document.createElement("div");
      container.style.overflowX = "auto";
      container.style.overflowY = "hidden";
      container.style.maxWidth = "100%";
      container.style.display = "block";
      container.style.minWidth = "1280px"; // fallback safeguard
      container.style.width = `${svgWidth}px`;
      container.style.marginTop = "2rem";
      container.style.position = "relative";

      // SVG innerHTML
      container.innerHTML = `
  <svg width="${svgWidth}" height="${svgHeight}" style="background-color: ${background_color}">
    <style>
      text {
        font-family: sans-serif;
        font-size: 16px;
      }
      .node { stroke-linecap: round; }
      .link { fill: none; }
    </style>
    <g id="zoom-group">
      ${tangleLayout.bundles.map((b, i) => {
        const d = b.links.map(l => `
          M${l.xt} ${l.yt}
          L${l.xt + labelClearance} ${l.yt}
          L${l.xb - l.c1} ${l.yt}
          A${l.c1} ${l.c1} 90 0 1 ${l.xb} ${l.yt + l.c1}
          L${l.xb} ${l.ys - l.c2}
          A${l.c2} ${l.c2} 90 0 0 ${l.xb + l.c2} ${l.ys}
          L${l.xs} ${l.ys}
        `).join("");

        return `
          <path class="link" d="${d}" stroke="${background_color}" stroke-width="5"/>
          <path class="link" d="${d}" stroke="${options.color(b, i)}" stroke-width="2"/>
        `;
      }).join("")}

      ${tangleLayout.nodes.map(n => `
        <path class="selectable node" data-id="${n.id}" stroke="black" stroke-width="8"
              d="M${n.x} ${n.y - n.height / 2} L${n.x} ${n.y + n.height / 2}"/>
        <path class="node" stroke="white" stroke-width="4"
              d="M${n.x} ${n.y - n.height / 2} L${n.x} ${n.y + n.height / 2}"/>
        <text class="selectable" data-id="${n.id}" x="${n.x + 4}" y="${n.y - n.height / 2 - 4}" stroke="${background_color}" stroke-width="2">
          ${n.id}
          <title>Author: ${n.author} (d. ${n.death} AH)</title>
        </text>
        <text x="${n.x + 4}" y="${n.y - n.height / 2 - 4}" style="pointer-events: none;">${n.id}</text>
      `).join("")}
    </g>
  </svg>
`;

      // --- D3 Zoom Setup ---
      const svgEl = container.querySelector("svg");
      const zoomGroup = container.querySelector("#zoom-group");
      const d3svg = d3.select(svgEl);
      const d3g = d3.select(zoomGroup);

      let currentTransform = d3.zoomIdentity;

      // Setup D3 zoom behavior (only on pinch/ctrl+scroll, not normal wheel)
      const zoom = d3.zoom()
        .scaleExtent([0.05, 4])
        .filter(function (event) {
          return event.type === "wheel"
            ? event.ctrlKey || event.metaKey
            : true;
        })
        .on("zoom", (event) => {
          d3g.attr("transform", event.transform);
          currentTransform = event.transform;
        });

      d3svg.call(zoom);

      // --- Zoom Controls UI ---
      const controls = document.createElement("div");
      controls.style.position = "absolute";
      controls.style.top = "20px";
      controls.style.right = "32px";
      controls.style.display = "flex";
      controls.style.gap = "8px";
      controls.style.zIndex = "10";
      controls.style.pointerEvents = "none"; // allows events through except to children

      const buttonStyle = `
  background-color: #588B8B;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.25rem;
  box-shadow: 0 1px 6px rgba(88,139,139,0.09);
  pointer-events: auto; /* ensures child buttons receive clicks */
  padding: 0;
`;

      // No border SVG, only simple icon centered
      const minusBtn = document.createElement("button");
      minusBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="display:block;margin:auto;" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="9" fill="#588B8B"/>
        <rect x="4.5" y="8.25" width="9" height="1.5" rx="0.75" fill="#fff"/>
      </svg>`;
      minusBtn.style = buttonStyle;

      const plusBtn = document.createElement("button");
      plusBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="display:block;margin:auto;" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="9" fill="#588B8B"/>
        <rect x="4.5" y="8.25" width="9" height="1.5" rx="0.75" fill="#fff"/>
        <rect x="8.25" y="4.5" width="1.5" height="9" rx="0.75" fill="#fff"/>
      </svg>`;
      plusBtn.style = buttonStyle;

      controls.appendChild(minusBtn);
      controls.appendChild(plusBtn);
      container.appendChild(controls);

      // Reliable button zoom logic: just call zoom.scaleBy
      function zoomAtPoint(factor) {
        // Get center of visible viewport in SVG coordinates
        const containerRect = container.getBoundingClientRect();
        const svgRect = svgEl.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const cx = scrollLeft + container.clientWidth / 2;
        const cy = scrollTop + container.clientHeight / 2;

        // Convert screen point to SVG coordinates using the current transform
        const pt = [cx, cy];
        let transform = d3.zoomTransform(svgEl);
        let svgPoint = transform.invert(pt);

        // Build new transform, scaling at the SVG-point under the center of the viewport
        let newK = Math.max(0.3, Math.min(4, transform.k * factor));
        let newTransform = d3.zoomIdentity
          .translate(transform.x, transform.y)
          .scale(newK);

        // Figure out where the same SVG-point would now map to
        let newScreenPoint = newTransform.apply(svgPoint);


        // Adjust translation so the SVG-point remains under the same screen center
        newTransform = newTransform.translate(cx - newScreenPoint[0], cy - newScreenPoint[1]);

        d3svg.transition().duration(300).call(zoom.transform, newTransform);
      }

      minusBtn.onclick = (e) => {
        e.preventDefault();
        zoomAtPoint(1 / 1.2);
      };
      plusBtn.onclick = (e) => {
        e.preventDefault();
        zoomAtPoint(1.2);
      };

      const resetBtn = document.createElement("button");
      resetBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" style="display:block;margin:auto;" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="9" r="9" fill="#588B8B"/>
          <rect x="8.25" y="4.5" width="1.5" height="9" rx="0.75" fill="#fff" transform="rotate(45 9 9)"/>
          <rect x="8.25" y="4.5" width="1.5" height="9" rx="0.75" fill="#fff" transform="rotate(-45 9 9)"/>
        </svg>
      `;

    

      resetBtn.style = buttonStyle;
      resetBtn.title = "Reset zoom";

      controls.appendChild(resetBtn);

      resetBtn.onclick = (e) => {
        e.preventDefault();
        d3svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
      };
      
      


      return container;
    }
  )
}


function _fullData() {
  return fetch("commentaries_observable_formatted.json")
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load JSON: ${res.status}`);
      return res.json();
    });
}

function _defaultLayers() {
  return fetch("commentaries_observable_nested.json")
    .then(res => res.json());
}

function _data(fullData) { return fullData }





function _constructTangleLayout(d3){return(
(levels, options={}) => {
  // precompute level depth
  levels.forEach((l, i) => l.forEach(n => (n.level = i)));

  var nodes = levels.reduce((a, x) => a.concat(x), []);
  var nodes_index = {};
  nodes.forEach(d => (nodes_index[d.id] = d));

  // objectification
  nodes.forEach(d => {
    d.parents = (d.parents === undefined ? [] : d.parents).map(
      p => nodes_index[p]
    );
  });

  // precompute bundles
  levels.forEach((l, i) => {
    var index = {};
    l.forEach(n => {
      if (n.parents.length == 0) {
        return;
      }

      var id = n.parents
        .map(d => d.id)
        .sort()
        .join('-X-');
      if (id in index) {
        index[id].parents = index[id].parents.concat(n.parents);
      } else {
        index[id] = { id: id, parents: n.parents.slice(), level: i, span: i - d3.min(n.parents, p => p.level) };
      }
      n.bundle = index[id];
    });
    l.bundles = Object.keys(index).map(k => index[k]);
    l.bundles.forEach((b, i) => (b.i = i));
  });

  var links = [];
  nodes.forEach(d => {
    d.parents.forEach(p =>
      links.push({ source: d, bundle: d.bundle, target: p })
    );
  });

  var bundles = levels.reduce((a, x) => a.concat(x.bundles), []);

  // reverse pointer from parent to bundles
  bundles.forEach(b =>
    b.parents.forEach(p => {
      if (p.bundles_index === undefined) {
        p.bundles_index = {};
      }
      if (!(b.id in p.bundles_index)) {
        p.bundles_index[b.id] = [];
      }
      p.bundles_index[b.id].push(b);
    })
  );

  nodes.forEach(n => {
    if (n.bundles_index !== undefined) {
      n.bundles = Object.keys(n.bundles_index).map(k => n.bundles_index[k]);
    } else {
      n.bundles_index = {};
      n.bundles = [];
    }
    n.bundles.sort((a,b) => d3.descending(d3.max(a, d => d.span), d3.max(b, d => d.span)))
    n.bundles.forEach((b, i) => (b.i = i));
  });

  links.forEach(l => {
    if (l.bundle.links === undefined) {
      l.bundle.links = [];
    }
    l.bundle.links.push(l);
  });

  // layout
  const padding = 8;
  const node_height = 22;
  const node_width = 70;
  const bundle_width = 14;
  const level_y_padding = 16;
  const metro_d = 4;
  const min_family_height = 22;
  const generationSpacing = 250;
  const bundleClearance = 300;
  const labelPadding = 500; // enough for long Arabic/English titles
  const baseGenerationSpacing = 150;
  const minContentWidth = 1280;
  
  

  
  options.c ||= 16;
  const c = options.c;
  options.bigc ||= node_width+c;

  nodes.forEach(
    n => (n.height = (Math.max(1, n.bundles.length) - 1) * metro_d)
  );

  var x_offset = padding;
  var y_offset = padding;
  if (levels.length === 1 && levels[0].length === 1) {
    // Single-node orphan: center it
    const n = levels[0][0];
    n.x = minContentWidth / 2; // center in SVG
    n.y = 100; // arbitrary vertical spacing
  } else {
    // Normal multi-node layout
    levels.forEach(l => {
      x_offset += l.bundles.length * bundle_width + baseGenerationSpacing;
      y_offset += level_y_padding;
      l.forEach((n, i) => {
        n.x = n.level * generationSpacing + x_offset;
        n.y = node_height + y_offset + n.height / 2;

        y_offset += node_height + n.height;
      });
    });
  }

  var i = 0;
  levels.forEach(l => {
    l.bundles.forEach(b => {
      b.x =
        d3.max(b.parents, d => d.x) +
        node_width +
        (l.bundles.length - 1 - b.i) * bundle_width + bundleClearance;
      b.y = i * node_height;
    });
    i += l.length;
  });

  links.forEach(l => {
    l.xt = l.target.x;
    l.yt =
      l.target.y +
      l.target.bundles_index[l.bundle.id].i * metro_d -
      (l.target.bundles.length * metro_d) / 2 +
      metro_d / 2;
    l.xb = l.bundle.x;
    l.yb = l.bundle.y;
    l.xs = l.source.x;
    l.ys = l.source.y;
  });
  
  // compress vertical space
  var y_negative_offset = 0;
  levels.forEach(l => {
    y_negative_offset +=
      -min_family_height +
        d3.min(l.bundles, b =>
          d3.min(b.links, link => link.ys - 2*c - (link.yt + c))
        ) || 0;
    l.forEach(n => (n.y -= y_negative_offset));
  });

  // very ugly, I know
  links.forEach(l => {
    l.yt =
      l.target.y +
      l.target.bundles_index[l.bundle.id].i * metro_d -
      (l.target.bundles.length * metro_d) / 2 +
      metro_d / 2;
    l.ys = l.source.y;
    l.c1 = l.source.level - l.target.level > 1 ? Math.min(options.bigc, l.xb-l.xt, l.yb-l.yt)-c : c;
    l.c2 = c;
  });

  var layout = {
    width: Math.max(
      d3.max(nodes, n => n.x + node_width + labelPadding),
      d3.max(bundles, b => b.x + bundle_width), minContentWidth
    ) + 2 * padding,

    height: Math.max(
      d3.max(nodes, n => n.y + node_height / 2),
      d3.max(bundles, b => b.y ?? 0)
    ) + 2 * padding,

    node_height,
    node_width,
    bundle_width,
    level_y_padding,
    metro_d
  };

  return { levels, nodes, nodes_index, links, bundles, layout };
}
)}

function _color(d3) { return d3.scaleOrdinal(d3.schemeDark2) }

function _background_color() { return 'white' }

function _9(md) { return (md`## Dependencies`) } // hidden

function _d3(require) {
  return require('d3-scale', 'd3-scale-chromatic', 'd3-array', 'd3-selection', 'd3-zoom') }

function __(require) { return require("lodash") }

export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("title")).define(["md"], _1);
  main.variable(observer("codeHeader")).define(["md"], _3);
  main.variable(observer("renderChart")).define("renderChart", ["color", "constructTangleLayout", "_", "svg", "background_color", "d3"], _renderChart);
  main.value("renderChart").then(fn => window.renderChart = fn);

  main.variable(observer("fullData")).define("fullData", _fullData);
  main.variable(observer("defaultLayers")).define("defaultLayers", _defaultLayers);

  // Only one dropdown registration, with both datasets!
  main.variable(observer()).define(["fullData", "defaultLayers"], _dropdown);

  main.variable(observer("constructTangleLayout")).define("constructTangleLayout", ["d3"], _constructTangleLayout);
  main.variable(observer("color")).define("color", ["d3"], _color);
  main.variable(observer("background_color")).define("background_color", _background_color);
  main.variable(observer("depsHeader")).define(["md"], _9);
  main.variable(observer("d3")).define("d3", ["require"], _d3);
  main.variable(observer("_")).define("_", ["require"], __);

  // Show the default tree on load, and allow reset to show it again
  main.value("defaultLayers").then(layers => {
    window.defaultLayersCache = layers;
    window.setFilteredData(layers);
    window.currentVis = "default";
  });

  return main;
}


window.setFilteredData = function (newData) {
  const chartArea = document.querySelector("#chart-area");
  if (chartArea) chartArea.innerHTML = "";
  const chart = window.renderChart(newData);
  document.querySelector("#chart-area")?.appendChild(chart);
};

