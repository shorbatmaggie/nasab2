function _1(md) {
  return md`# Nasab2`;
}

function extractAncestry(targetId, fullData) {
  const flat = fullData.flat();
  const lookup = Object.fromEntries(flat.map(n => [n.id, n]));
  const visited = new Set();
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!visited.has(current)) {
      visited.add(current);
      const parents = lookup[current]?.parents || [];
      for (const p of parents) queue.push(p);
    }
  }

  const ancestors = flat.filter(n => visited.has(n.id));
  ancestors.push(lookup[targetId]);

  const genMap = new Map();
  const assignLevel = (node, level = 0) => {
    if (genMap.has(node.id)) return;
    genMap.set(node.id, level);
    for (const p of node.parents || []) assignLevel(lookup[p], level - 1);
  };

  assignLevel(lookup[targetId], 0);

  const grouped = [];
  for (const [id, level] of genMap.entries()) {
    const node = lookup[id];
    const gen = grouped[-level] || (grouped[-level] = []);
    gen.push(node);
  }

  return grouped.reverse();

}

function extractDescendants(targetId, fullData) {
  const flat = fullData.flat();
  const lookup = Object.fromEntries(flat.map(n => [n.id, n]));
  const childrenMap = new Map();

  for (const node of flat) {
    for (const parent of node.parents || []) {
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent).push(node.id);
    }
  }

  const visited = new Set();
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!visited.has(current)) {
      visited.add(current);
      const children = childrenMap.get(current) || [];
      for (const child of children) {
        queue.push(child);
      }
    }
  }

  const descendants = flat.filter(n => visited.has(n.id));
  const genMap = new Map();

  const assignLevel = (node, level = 0) => {
    if (genMap.has(node.id)) return;
    genMap.set(node.id, level);
    for (const child of childrenMap.get(node.id) || []) {
      assignLevel(lookup[child], level + 1);
    }
  };

  assignLevel(lookup[targetId], 0);

  const grouped = [];
  for (const [id, level] of genMap.entries()) {
    const node = lookup[id];
    const gen = grouped[level] || (grouped[level] = []);
    gen.push(node);
  }

  // ✅ Sanity patch: remove references to parents not included in this subgraph
  const validIDs = new Set(descendants.map(n => n.id));
  for (const level of grouped) {
    for (const node of level) {
      node.parents = (node.parents || []).filter(p => validIDs.has(p));
    }
  }

  return grouped;
}

function _dropdown(fullData) {
  const flat = fullData.flat();
  const sorted = [...flat].sort((a, b) => a.id.localeCompare(b.id, "en"));

  const createDropdown = (labelText, onChangeFn, id) => {
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.className = "block font-semibold mb-1";
    label.textContent = labelText;

    const select = document.createElement("select");
    select.id = id;
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

    // OnChange logic
    select.onchange = ((label, handler) => () => {
      const selectedID = select.value;
      if (!selectedID) return;

      const subgraph = handler(selectedID, fullData);

      // Check for orphan (1 node, 1 level)
      if (subgraph.length === 1 && subgraph[0].length === 1) {
        document.getElementById("chart-area").innerHTML = `
          <div class="text-center text-gray-500 italic py-8">
            None found.
          </div>
        `;
      } else {
        window.setFilteredData(subgraph);
      }
    })(labelText, onChangeFn);
    

    return [label, select];
  };

  // === DOM STRUCTURE ===

  const section = document.createElement("section");
  section.className = "p-4 bg-white text-[#588B8B] rounded-xl shadow";

  const title = document.createElement("h2");
  title.className = "text-xl font-bold mb-2";
  title.textContent = "Explore a Genealogy";

  const [ancestryLabel, ancestrySelect] = createDropdown("View Ancestry:", extractAncestry, "ancestry-select");
  const [descendantLabel, descendantSelect] = createDropdown("View Descendants:", extractDescendants, "descendant-select");

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset to Full Tree";
  resetBtn.className = "mt-2 px-4 py-2 rounded shadow";
  resetBtn.style.backgroundColor = "#588B8B";
  resetBtn.style.color = "white";

  resetBtn.onclick = () => {
    window.setFilteredData(fullData);

    // Reset dropdowns
    const ancestrySelect = document.getElementById("ancestry-select");
    const descendantSelect = document.getElementById("descendant-select");

    if (ancestrySelect) ancestrySelect.value = "";
    if (descendantSelect) descendantSelect.value = "";
  };
  

  section.append(title, ancestryLabel, ancestrySelect, descendantLabel, descendantSelect, resetBtn);

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

function _renderChart(color, constructTangleLayout, _, svg, background_color) {
  return (
    (data, options = {}) => {
      options.color ||= (d, i) => color(i);
      const tangleLayout = constructTangleLayout(_.cloneDeep(data), options);

      const svgWidth = tangleLayout.layout.width;
      const svgHeight = tangleLayout.layout.height;
      const labelClearance = 10;

      const container = document.createElement("div");
      container.style.overflowX = "auto";
      container.style.overflowY = "hidden";
      container.style.maxWidth = "100%";
      container.style.display = "block";
      container.style.minWidth = "1280px"; // fallback safeguard
      container.style.width = `${svgWidth}px`; // lock width to layout
      container.style.marginTop = "2rem"; // ✅ space below dropdown
      

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

      const svgEl = container.querySelector("svg");
      const zoomGroup = container.querySelector("#zoom-group");

      const d3svg = d3.select(svgEl);
      const d3g = d3.select(zoomGroup);

      const zoom = d3.zoom()
        .scaleExtent([0.3, 4]) // zoom out to 30%, in to 400%
        .on("zoom", (event) => {
          d3g.attr("transform", event.transform);
        });

      d3svg.call(zoom);

      return container;
    }
  )
}

function _fullData() {
  return fetch("commentaries_observable_nested.json")
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load JSON: ${res.status}`);
      return res.json();
    });
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
  return require("d3");
}


function __(require) { return require("lodash") }

export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("title")).define(["md"], _1);
  main.variable(observer()).define(["renderChart", "data"], _2);
  main.variable(observer("codeHeader")).define(["md"], _3);
  main.variable(observer("renderChart")).define("renderChart", ["color", "constructTangleLayout", "_", "svg", "background_color", "d3"], _renderChart);
  main.value("renderChart").then(fn => window.renderChart = fn);
  main.variable(observer("fullData")).define("fullData", _fullData);
  main.variable(observer("data")).define("data", ["fullData"], _data);
  main.variable(observer("constructTangleLayout")).define("constructTangleLayout", ["d3"], _constructTangleLayout);
  main.variable(observer("color")).define("color", ["d3"], _color);
  main.variable(observer("background_color")).define("background_color", _background_color);
  main.variable(observer()).define(["fullData"], _dropdown);
  main.variable(observer("depsHeader")).define(["md"], _9);
  main.variable(observer("d3")).define("d3", ["require"], _d3);
  main.variable(observer("_")).define("_", ["require"], __);

  return main;
}

window.setFilteredData = function (newData) {
  const chartArea = document.querySelector("#chart-area");
  if (chartArea) chartArea.innerHTML = "";
  const chart = window.renderChart(newData);
  document.querySelector("#chart-area")?.appendChild(chart);
};
