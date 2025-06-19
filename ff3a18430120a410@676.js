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
      console.log(label, "selected ID:", selectedID);
      console.log(label, "subgraph:", subgraph);
      window.setFilteredData(subgraph);
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
  resetBtn.onclick = () => window.setFilteredData(fullData);

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
      container.style.backgroundColor = "#fdd"; // 🧪 debug only

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
    </svg>
    `;

      return container;
    }
  )
}


function _fullData(){
  return(
    [
      [
        {
          "id": "Mukhtaṣar al-Muzanī",
          "label": "Mukhtaṣar al-Muzanī",
          "parents": [],
          "death": 264,
          "author": "al-Muzanī"
        },
        {
          "id": "al-Tanbīh",
          "label": "al-Tanbīh",
          "parents": [],
          "death": 393,
          "author": "al-Shīrāzī"
        },
        {
          "id": "al-Muhadhdhab fī Fiqh al-Imām al-Shāfiʿī",
          "label": "al-Muhadhdhab fī Fiqh al-Imām al-Shāfiʿī",
          "parents": [],
          "death": 393,
          "author": "al-Shīrāzī"
        },
        {
          "id": "Matn Abī Shujāʿ ",
          "label": "Matn Abī Shujāʿ ",
          "parents": [],
          "death": 500,
          "author": "Abū Shujāʿ "
        },
        {
          "id": "al-Muḥarrar li-l-Rafi'i ",
          "label": "al-Muḥarrar li-l-Rafi'i ",
          "parents": [],
          "death": 623,
          "author": "al-Rāfiʿī"
        },
        {
          "id": "Sharḥ al-Wajīz li-l-Rāfiʿī",
          "label": "Sharḥ al-Wajīz li-l-Rāfiʿī",
          "parents": [],
          "death": 623,
          "author": "al-Rāfiʿī"
        },
        {
          "id": "al-Ghurar al-Bahiyya fī Sharḥ al-Bahja al-Wardiyya",
          "label": "al-Ghurar al-Bahiyya fī Sharḥ al-Bahja al-Wardiyya",
          "parents": [],
          "death": 926,
          "author": "al-Anṣārī"
        },
        {
          "id": "Qurrat al-ʿAyn bi-Muhimmāt al-Dīn",
          "label": "Qurrat al-ʿAyn bi-Muhimmāt al-Dīn",
          "parents": [],
          "death": 987,
          "author": "al-Maʿbarī"
        }
      ],
      [
        {
          "id": "al-Ḥāwī al-Kabīr",
          "label": "al-Ḥāwī al-Kabīr",
          "parents": [
            "Mukhtaṣar al-Muzanī"
          ],
          "death": 450,
          "author": "al-Mawardī"
        },
        {
          "id": "Nihāyat al-Maṭlab fī Dirāyat al-Madhhab",
          "label": "Nihāyat al-Maṭlab fī Dirāyat al-Madhhab",
          "parents": [
            "Mukhtaṣar al-Muzanī"
          ],
          "death": 478,
          "author": "al-Juwaynī"
        },
        {
          "id": "Baḥr al-Madhhab",
          "label": "Baḥr al-Madhhab",
          "parents": [
            "Mukhtaṣar al-Muzanī"
          ],
          "death": 502,
          "author": "al-Rūyānī"
        },
        {
          "id": "Ḥilyat al-ʿUlamāʾ fī Maʿrifat Madhāhib al-Fuqahāʾ",
          "label": "Ḥilyat al-ʿUlamāʾ fī Maʿrifat Madhāhib al-Fuqahāʾ",
          "parents": [
            "Mukhtaṣar al-Muzanī"
          ],
          "death": 507,
          "author": "al-Shāshī"
        },
        {
          "id": "Itḥāf al-Arīb bi-Sharḥ al-Ghāya wa-l-Taqrīb",
          "label": "Itḥāf al-Arīb bi-Sharḥ al-Ghāya wa-l-Taqrīb",
          "parents": [
            "Matn Abī Shujāʿ "
          ],
          "death": 593,
          "author": "al-Shubrāwī"
        },
        {
          "id": "Rawḍat al-Ṭālibīn",
          "label": "Rawḍat al-Ṭālibīn",
          "parents": [
            "Sharḥ al-Wajīz li-l-Rāfiʿī"
          ],
          "death": 676,
          "author": "al-Nawawī"
        },
        {
          "id": "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn",
          "label": "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn",
          "parents": [
            "al-Muḥarrar li-l-Rafi'i "
          ],
          "death": 676,
          "author": "al-Nawawī"
        },
        {
          "id": "al-Majmūʿ Sharḥ al-Muhadhdhab",
          "label": "al-Majmūʿ Sharḥ al-Muhadhdhab",
          "parents": [
            "al-Muhadhdhab fī Fiqh al-Imām al-Shāfiʿī"
          ],
          "death": 676,
          "author": "al-Nawawī"
        },
        {
          "id": "Kifāyat al-Nabīh bi-Sharḥ al-Tanbīh",
          "label": "Kifāyat al-Nabīh bi-Sharḥ al-Tanbīh",
          "parents": [
            "al-Tanbīh"
          ],
          "death": 710,
          "author": "Ibn al-Rifʿa"
        },
        {
          "id": "Takmilat Sharḥ al-Imām al-Nawawī",
          "label": "Takmilat Sharḥ al-Imām al-Nawawī",
          "parents": [
            "al-Muhadhdhab fī Fiqh al-Imām al-Shāfiʿī"
          ],
          "death": 756,
          "author": "al-Subkī"
        },
        {
          "id": "Kifāyat al-Akhyār fī Ḥall Ghāyat al-Ikhtiṣār",
          "label": "Kifāyat al-Akhyār fī Ḥall Ghāyat al-Ikhtiṣār",
          "parents": [
            "Matn Abī Shujāʿ "
          ],
          "death": 829,
          "author": "al-Ḥiṣnī"
        },
        {
          "id": "al-Qawl al-Mukhtār fī Sharḥ Ghāyat al-Ikhtiṣār",
          "label": "al-Qawl al-Mukhtār fī Sharḥ Ghāyat al-Ikhtiṣār",
          "parents": [
            "Matn Abī Shujāʿ "
          ],
          "death": 918,
          "author": "Ibn Qāsim "
        },
        {
          "id": "Ḥāshiyat al-Shirbīnī ʿalā al-Ghurar al-Bahiyya fī Sharḥ al-Bahja al-Wardiyya",
          "label": "Ḥāshiyat al-Shirbīnī ʿalā al-Ghurar al-Bahiyya fī Sharḥ al-Bahja al-Wardiyya",
          "parents": [
            "al-Ghurar al-Bahiyya fī Sharḥ al-Bahja al-Wardiyya"
          ],
          "death": 977,
          "author": "al-Khaṭīb al-Shirbīnī"
        },
        {
          "id": "al-Iqnāʿ fī Ḥall Alfāẓ Abī Shujāʿ",
          "label": "al-Iqnāʿ fī Ḥall Alfāẓ Abī Shujāʿ",
          "parents": [
            "Matn Abī Shujāʿ "
          ],
          "death": 977,
          "author": "al-Khaṭīb al-Shirbīnī"
        },
        {
          "id": "Fatḥ al-Muʿīn bi-Sharḥ Qurrat al-ʿAyn bi-Muhimmāt al-Dīn",
          "label": "Fatḥ al-Muʿīn bi-Sharḥ Qurrat al-ʿAyn bi-Muhimmāt al-Dīn",
          "parents": [
            "Qurrat al-ʿAyn bi-Muhimmāt al-Dīn"
          ],
          "death": 987,
          "author": "al-Maʿbarī"
        },
        {
          "id": "Ḥāshiyat al-ʿAbbādī ʿalā al-Ghurar al-Bahiyya fī Sharḥ al-Bahja al-Wardiyya",
          "label": "Ḥāshiyat al-ʿAbbādī ʿalā al-Ghurar al-Bahiyya fī Sharḥ al-Bahja al-Wardiyya",
          "parents": [
            "al-Ghurar al-Bahiyya fī Sharḥ al-Bahja al-Wardiyya"
          ],
          "death": 992,
          "author": "Ibn Qāsim al-ʿAbbādī"
        },
        {
          "id": "Takmilat Sharḥ al-Majmūʿ",
          "label": "Takmilat Sharḥ al-Majmūʿ",
          "parents": [
            "al-Muhadhdhab fī Fiqh al-Imām al-Shāfiʿī"
          ],
          "death": 1406,
          "author": "al-Muṭīʿī"
        }
      ],
      [
        {
          "id": "al-Ghāya fī Ikhtiṣār al-Nihāya",
          "label": "al-Ghāya fī Ikhtiṣār al-Nihāya",
          "parents": [
            "Nihāyat al-Maṭlab fī Dirāyat al-Madhhab"
          ],
          "death": 660,
          "author": "Ibn ʿAbd al-Salām"
        },
        {
          "id": "Daqāʾiq al-Minhāj",
          "label": "Daqāʾiq al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 676,
          "author": "al-Nawawī"
        },
        {
          "id": "al-Ibtihāj Mukhtaṣar al-Minhāj",
          "label": "al-Ibtihāj Mukhtaṣar al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 729,
          "author": " al-Qūnawī "
        },
        {
          "id": "Bayān Gharaḍ al-Muḥtāj ilā Kitāb al-Minhāj",
          "label": "Bayān Gharaḍ al-Muḥtāj ilā Kitāb al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 729,
          "author": "Ibn al-Firkāḥ "
        },
        {
          "id": "al-Sirāj al-Wahhāj Sharḥ Minhāj al-Ṭālibīn",
          "label": "al-Sirāj al-Wahhāj Sharḥ Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 740,
          "author": "al-Sanklūnī "
        },
        {
          "id": "Mukhtaṣar al-Rawḍa",
          "label": "Mukhtaṣar al-Rawḍa",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 750,
          "author": "al-Aṣfunī "
        },
        {
          "id": "al-Ibtihāj Sharḥ al-Minhāj",
          "label": "al-Ibtihāj Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 756,
          "author": "al-Subkī"
        },
        {
          "id": "al-Sirāj fī Nukat al-Minhāj",
          "label": "al-Sirāj fī Nukat al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 769,
          "author": "Ibn al-Naqīb"
        },
        {
          "id": "Tarshīḥ al-Tawshīḥ fī Tarjīḥ al-Taṣḥīḥ",
          "label": "Tarshīḥ al-Tawshīḥ fī Tarjīḥ al-Taṣḥīḥ",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 771,
          "author": "Ibn al-Subkī"
        },
        {
          "id": "Kāfī al-Muḥtāj Sharḥ al-Minhāj [li-l-Isnawī]",
          "label": "Kāfī al-Muḥtāj Sharḥ al-Minhāj [li-l-Isnawī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 772,
          "author": "al-Isnawī"
        },
        {
          "id": "al-Hidāya ilā Awhām al-Kifāya",
          "label": "al-Hidāya ilā Awhām al-Kifāya",
          "parents": [
            "Kifāyat al-Nabīh bi-Sharḥ al-Tanbīh"
          ],
          "death": 772,
          "author": "al-Isnawī"
        },
        {
          "id": "al-Muhimmāt ʿalā al-Rawḍa",
          "label": "al-Muhimmāt ʿalā al-Rawḍa",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 772,
          "author": "al-Isnawī"
        },
        {
          "id": "al-Furūq Ziyādāt ʿalā al-Minhāj",
          "label": "al-Furūq Ziyādāt ʿalā al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 772,
          "author": "al-Isnawī"
        },
        {
          "id": "al-Tawassuṭ wa-l-Fatḥ bayna al-Rawḍa wa-l-Sharḥ",
          "label": "al-Tawassuṭ wa-l-Fatḥ bayna al-Rawḍa wa-l-Sharḥ",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 783,
          "author": "al-Adhraʿī"
        },
        {
          "id": "Ghunyat al-Muḥtāj fī Sharḥ al-Minhāj fī ʿAshara Mujalladāt",
          "label": "Ghunyat al-Muḥtāj fī Sharḥ al-Minhāj fī ʿAshara Mujalladāt",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 783,
          "author": "al-Adhraʿī"
        },
        {
          "id": "Qūt al-Muḥtāj fī Sharḥ al-Minhāj",
          "label": "Qūt al-Muḥtāj fī Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 783,
          "author": "al-Adhraʿī"
        },
        {
          "id": "Minhāj al-Rāghibīn fī Ikhtiṣār Minhāj al-Ṭālibīn",
          "label": "Minhāj al-Rāghibīn fī Ikhtiṣār Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 788,
          "author": "Shams al-Dīn al-Qūnawī"
        },
        {
          "id": "Sharḥ al-Minhāj [li-l-Dhamārī]",
          "label": "Sharḥ al-Minhāj [li-l-Dhamārī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 790,
          "author": "al-Dhamārī"
        },
        {
          "id": "Khādim al-Rāfiʿī wa-l-Rawḍa",
          "label": "Khādim al-Rāfiʿī wa-l-Rawḍa",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 794,
          "author": "al-Zarkashī"
        },
        {
          "id": "al-Dībāj bi-Tawḍīḥ al-Minhāj",
          "label": "al-Dībāj bi-Tawḍīḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 794,
          "author": "al-Zarkashī"
        },
        {
          "id": "Takmilat Sharḥ al-Minhāj li-l-Isnawī",
          "label": "Takmilat Sharḥ al-Minhāj li-l-Isnawī",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 794,
          "author": "al-Zarkashī"
        },
        {
          "id": "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]",
          "label": "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 799,
          "author": "Sharaf al-Dīn al-Ghazzī "
        },
        {
          "id": "ʿAjālat al-Muḥtāj ilā Tawjīh al-Minhāj",
          "label": "ʿAjālat al-Muḥtāj ilā Tawjīh al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 804,
          "author": "Ibn al-Mulaqqin"
        },
        {
          "id": "Kāfī al-Muḥtāj Sharḥ al-Minhāj [li-Ibn al-Mulaqqin]",
          "label": "Kāfī al-Muḥtāj Sharḥ al-Minhāj [li-Ibn al-Mulaqqin]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 804,
          "author": "Ibn al-Mulaqqin"
        },
        {
          "id": "ʿUmdat al-Muḥtāj ilā Sharḥ al-Minhāj",
          "label": "ʿUmdat al-Muḥtāj ilā Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 804,
          "author": "Ibn al-Mulaqqin"
        },
        {
          "id": "Tuḥfat al-Muḥtāj ilā Adillat al-Minhāj",
          "label": "Tuḥfat al-Muḥtāj ilā Adillat al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 804,
          "author": "Ibn al-Mulaqqin"
        },
        {
          "id": "al-Ishārāt ilā Mā Waqaʿa fī al-Minhāj min al-Asmāʾ wa-l-Maʿānī wa-l-Lughāt",
          "label": "al-Ishārāt ilā Mā Waqaʿa fī al-Minhāj min al-Asmāʾ wa-l-Maʿānī wa-l-Lughāt",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 804,
          "author": "Ibn al-Mulaqqin"
        },
        {
          "id": "Ḥawāsh ʿalā al-Rawḍa",
          "label": "Ḥawāsh ʿalā al-Rawḍa",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 805,
          "author": "Sirāj al-Dīn al-Bulqīnī "
        },
        {
          "id": "Taṣḥīḥ al-Minhāj",
          "label": "Taṣḥīḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 805,
          "author": "Sirāj al-Dīn al-Bulqīnī "
        },
        {
          "id": "al-Najm al-Wahhāj bi-Sharḥ al-Minhāj",
          "label": "al-Najm al-Wahhāj bi-Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 808,
          "author": "al-Damīrī"
        },
        {
          "id": "Tawḍīḥ Sharḥ al-Minhāj",
          "label": "Tawḍīḥ Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 808,
          "author": "Ibn ʿImād "
        },
        {
          "id": "Silāḥ al-Iḥtijāj fī al-Dhabb ʿan al-Minhāj",
          "label": "Silāḥ al-Iḥtijāj fī al-Dhabb ʿan al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 808,
          "author": "al-ʿIyzarī"
        },
        {
          "id": "Ḥawāʾish ʿalā al-Rawḍa",
          "label": "Ḥawāʾish ʿalā al-Rawḍa",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 824,
          "author": "Jalāl al-Dīn al-Bulqīnī"
        },
        {
          "id": "Taḥrīr al-Fatāwā ʿalā al-Tanbīh wa-l-Minhāj wa-l-Ḥāwī",
          "label": "Taḥrīr al-Fatāwā ʿalā al-Tanbīh wa-l-Minhāj wa-l-Ḥāwī",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn",
            "al-Tanbīh"
          ],
          "death": 826,
          "author": "Ibn al-ʿIrāqī"
        },
        {
          "id": "Kifāyat al-Muḥtāj fī Ḥall Alfāẓ al-Minhāj",
          "label": "Kifāyat al-Muḥtāj fī Ḥall Alfāẓ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 829,
          "author": "al-Ḥiṣnī"
        },
        {
          "id": "Rawd al-Ṭālib",
          "label": "Rawd al-Ṭālib",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 837,
          "author": "Ibn al-Muqrī"
        },
        {
          "id": "Dalāʾil al-Minhāj",
          "label": "Dalāʾil al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 839,
          "author": "ʿUbayd al-Ḍarīr"
        },
        {
          "id": "Fawāʾid al-Minhāj wa-Farāʾid al-Muḥtāj",
          "label": "Fawāʾid al-Minhāj wa-Farāʾid al-Muḥtāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 842,
          "author": "Ibn al-ʿIrāqī"
        },
        {
          "id": "Sharḥ al-Minhāj [li-Ibn Raslān]",
          "label": "Sharḥ al-Minhāj [li-Ibn Raslān]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 844,
          "author": "Ibn Raslān"
        },
        {
          "id": "Natāʾij Ghawāmiḍ al-Fikr fī Tartīb Masāʾil al-Minhāj ʿalā al-Mukhtaṣar",
          "label": "Natāʾij Ghawāmiḍ al-Fikr fī Tartīb Masāʾil al-Minhāj ʿalā al-Mukhtaṣar",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 844,
          "author": "al-Ṣayrafī "
        },
        {
          "id": "Murshid al-Sāʾil Mukhtaṣar al-Rawḍa",
          "label": "Murshid al-Sāʾil Mukhtaṣar al-Rawḍa",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 849,
          "author": "al-Ḥijāzī al-Falyūbī"
        },
        {
          "id": "Sharḥ Minhāj al-Ṭālibīn [li-l-Qāyātī]",
          "label": "Sharḥ Minhāj al-Ṭālibīn [li-l-Qāyātī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 850,
          "author": "al-Qāyātī"
        },
        {
          "id": "Mukhtaṣar al-Rawḍ wa-Sharḥihi",
          "label": "Mukhtaṣar al-Rawḍ wa-Sharḥihi",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 852,
          "author": "Ibn Ḥajar al-ʿAsqalānī"
        },
        {
          "id": "al-Ḥalāwa al-Sukariyya fī Naẓm Farāʾiḍ al-Minhāj al-Nawawiyya",
          "label": "al-Ḥalāwa al-Sukariyya fī Naẓm Farāʾiḍ al-Minhāj al-Nawawiyya",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 855,
          "author": "Burhān al-Dīn al-Nawawī"
        },
        {
          "id": "al-Rawḍ al-Fāʾiq fī al-Minhāj wa-l-Daqāʾiq",
          "label": "al-Rawḍ al-Fāʾiq fī al-Minhāj wa-l-Daqāʾiq",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 855,
          "author": "Burhān al-Dīn al-Nawawī"
        },
        {
          "id": "al-Mashraʿ al-Rawī fī Sharḥ Minhāj al-Nawawī",
          "label": "al-Mashraʿ al-Rawī fī Sharḥ Minhāj al-Nawawī",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 859,
          "author": "Ibn al-Marāghī"
        },
        {
          "id": "Sharḥ al-Minhāj jamaʿa fīhi bayna Sharḥ Ibn al-Mulaqqin wa-l-Isnawī wa-l-Takmila",
          "label": "Sharḥ al-Minhāj jamaʿa fīhi bayna Sharḥ Ibn al-Mulaqqin wa-l-Isnawī wa-l-Takmila",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 862,
          "author": " al-Miṣrī"
        },
        {
          "id": "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]",
          "label": "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 864,
          "author": "al-Maḥallī"
        },
        {
          "id": "al-Iʿtināʾ wa-l-Ihtimām bi-Fawāʾid Shaykhay al-Islām (Jamaʿa fīhī bayna Ḥawāshatay Wālidihī wa-Akhīhī)",
          "label": "al-Iʿtināʾ wa-l-Ihtimām bi-Fawāʾid Shaykhay al-Islām (Jamaʿa fīhī bayna Ḥawāshatay Wālidihī wa-Akhīhī)",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 868,
          "author": "ʿAlam al-Dīn al-Bulqīnī"
        },
        {
          "id": "al-Baḥr al-Mawwāj fī Sharḥ al-Minhāj",
          "label": "al-Baḥr al-Mawwāj fī Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 871,
          "author": " al-Mārdīnī "
        },
        {
          "id": "Bidāyat al-Muḥtāj fī Sharḥ al-Minhāj",
          "label": "Bidāyat al-Muḥtāj fī Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 874,
          "author": "Ibn Qāḍī Shuhba"
        },
        {
          "id": "Irshād al-Muḥtāj fī Sharḥ al-Minhāj",
          "label": "Irshād al-Muḥtāj fī Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 874,
          "author": "Ibn Qāḍī Shuhba"
        },
        {
          "id": "al-Ghayth al-Fāʾiḍ fī ʿIlm al-Farāʾiḍ",
          "label": "al-Ghayth al-Fāʾiḍ fī ʿIlm al-Farāʾiḍ",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 875,
          "author": "al-Ḥusaynī"
        },
        {
          "id": "Tadhkirat al-Muḥtāj fī Sharḥ al-Minhāj",
          "label": "Tadhkirat al-Muḥtāj fī Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 875,
          "author": "al-Ḥusaynī"
        },
        {
          "id": "al-Tāj fī Zawāʾid al-Rawḍa ʿalā al-Minhāj",
          "label": "al-Tāj fī Zawāʾid al-Rawḍa ʿalā al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn",
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 876,
          "author": "(Ibn) Qāḍī ʿAjlūn"
        },
        {
          "id": "Mughnī al-Rāghibīn bi-Taṣḥīḥ Minhāj al-Ṭālibīn",
          "label": "Mughnī al-Rāghibīn bi-Taṣḥīḥ Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 876,
          "author": "(Ibn) Qāḍī ʿAjlūn"
        },
        {
          "id": "Iʿlām al-Nabīh mimmā Zāda ʿalā al-Minhāj min al-Ḥāwī wa-l-Tanbīh",
          "label": "Iʿlām al-Nabīh mimmā Zāda ʿalā al-Minhāj min al-Ḥāwī wa-l-Tanbīh",
          "parents": [
            "al-Tanbīh",
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn",
            "al-Ḥāwī al-Kabīr"
          ],
          "death": 876,
          "author": "(Ibn) Qāḍī ʿAjlūn"
        },
        {
          "id": "al-Iyḍāḥ ʿalā Khaṭiyyat Minhāj al-Ṭālibīn",
          "label": "al-Iyḍāḥ ʿalā Khaṭiyyat Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 883,
          "author": "Ibn Burayda"
        },
        {
          "id": "Nukat ʿalā al-Minhāj",
          "label": "Nukat ʿalā al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 891,
          "author": "al-Jalāl al-Bakrī"
        },
        {
          "id": "Sharḥ al-Minhāj [li-l-Jalāl al-Bakrī]",
          "label": "Sharḥ al-Minhāj [li-l-Jalāl al-Bakrī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 891,
          "author": "al-Jalāl al-Bakrī"
        },
        {
          "id": "Nahajat al-Rāghibīn bi-Ḥawāshī Rawdat al-Ṭālibīn",
          "label": "Nahajat al-Rāghibīn bi-Ḥawāshī Rawdat al-Ṭālibīn",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 891,
          "author": "al-Jalāl al-Bakrī"
        },
        {
          "id": "Tuḥfat al-Rāghibīn fī Taḥrīr Minhāj al-Ṭālibīn",
          "label": "Tuḥfat al-Rāghibīn fī Taḥrīr Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 905,
          "author": "Abū al-Faḍl al-Dimashqī"
        },
        {
          "id": "Sharḥ al-Minhāj [li-Ibn Abī Sharīf]",
          "label": "Sharḥ al-Minhāj [li-Ibn Abī Sharīf]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 906,
          "author": "Ibn Abī Sharīf"
        },
        {
          "id": "al-Azhār al-Ghaḍḍa fī Sharḥ al-Rawḍa",
          "label": "al-Azhār al-Ghaḍḍa fī Sharḥ al-Rawḍa",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 911,
          "author": "al-Suyūṭī"
        },
        {
          "id": "al-Yunūʿ fīmā ʿalā al-Rawḍa min al-Furūʿ",
          "label": "al-Yunūʿ fīmā ʿalā al-Rawḍa min al-Furūʿ",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 911,
          "author": "al-Suyūṭī"
        },
        {
          "id": "Durrat al-Tāj fī Iʿrāb Mushkil al-Minhāj",
          "label": "Durrat al-Tāj fī Iʿrāb Mushkil al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 911,
          "author": "al-Suyūṭī"
        },
        {
          "id": "al-Qawl al-Mustajād fī Sharḥ Kitāb Ummahāt al-Awlād",
          "label": "al-Qawl al-Mustajād fī Sharḥ Kitāb Ummahāt al-Awlād",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 912,
          "author": "al-Samhūdī"
        },
        {
          "id": "al-Ibtihāj bi-Sharḥ al-Minhāj",
          "label": "al-Ibtihāj bi-Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 916,
          "author": "al-Naṣībī"
        },
        {
          "id": "Bahjat al-Rāghibīn bi-Ḥawāshī Rawdat al-Ṭālibīn",
          "label": "Bahjat al-Rāghibīn bi-Ḥawāshī Rawdat al-Ṭālibīn",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 916,
          "author": "al-Naṣībī"
        },
        {
          "id": "Surūr al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn",
          "label": "Surūr al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 921,
          "author": "al-Dīrūṭī "
        },
        {
          "id": "Sharḥ al-Minhāj (Sharḥ Farāʾiḍ al-Minhāj)",
          "label": "Sharḥ al-Minhāj (Sharḥ Farāʾiḍ al-Minhāj)",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 926,
          "author": "al-Anṣārī"
        },
        {
          "id": "Manhaj al-Ṭullāb",
          "label": "Manhaj al-Ṭullāb",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 926,
          "author": "al-Anṣārī"
        },
        {
          "id": "al-ʿUbāb al-Muḥīṭ bi-Muʿẓam Nuṣūṣ al-Shāfiʿī wa-l-Aṣḥāb (Mukhtasar al-Rawḍa)",
          "label": "al-ʿUbāb al-Muḥīṭ bi-Muʿẓam Nuṣūṣ al-Shāfiʿī wa-l-Aṣḥāb (Mukhtasar al-Rawḍa)",
          "parents": [
            "Rawḍat al-Ṭālibīn"
          ],
          "death": 930,
          "author": "al-Muzajjad"
        },
        {
          "id": "Ighāthat al-Lahhāj fī Sharḥ Farāʾiḍ al-Minhāj",
          "label": "Ighāthat al-Lahhāj fī Sharḥ Farāʾiḍ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 932,
          "author": "al-Kafarsūsī "
        },
        {
          "id": "Surūr al-Rāghibīn Sharḥ Minhāj al-Ṭālibīn",
          "label": "Surūr al-Rāghibīn Sharḥ Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 949,
          "author": "Ibn al-ʿArūs al-Azharī"
        },
        {
          "id": "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-Abī al-Ḥasan al-Bakrī]",
          "label": "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-Abī al-Ḥasan al-Bakrī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 952,
          "author": "Abū al-Ḥasan al-Bakrī"
        },
        {
          "id": "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Ibn Ḥajar al-Haytamī]",
          "label": "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Ibn Ḥajar al-Haytamī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 974,
          "author": "Ibn Ḥajar al-Haytamī"
        },
        {
          "id": "Mughnī al-Muḥtāj ilā Maʿrifat Maʿānī Alfāẓ al-Minhāj",
          "label": "Mughnī al-Muḥtāj ilā Maʿrifat Maʿānī Alfāẓ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 977,
          "author": "al-Khaṭīb al-Shirbīnī"
        },
        {
          "id": "Intiʿāsh al-Akbād ʿalā Kitāb Ummahāt al-Awlād min Minhāj al-Ṭālibīn",
          "label": "Intiʿāsh al-Akbād ʿalā Kitāb Ummahāt al-Awlād min Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 981,
          "author": "Najm al-Dīn al-Ghayṭī"
        },
        {
          "id": "Ibtihāj al-Muḥtāj bi-Sharḥ al-Muḥtāj",
          "label": "Ibtihāj al-Muḥtāj bi-Sharḥ al-Muḥtāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 984,
          "author": "Abū al-Barakāt al-Ghazzī"
        },
        {
          "id": "Nihāyat (Ghāyat) al-Muḥtāj bi-Sharḥ al-Minhāj",
          "label": "Nihāyat (Ghāyat) al-Muḥtāj bi-Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1004,
          "author": "Shams al-Dīn al-Ramlī"
        },
        {
          "id": "Fayḍ al-Jūd bi-Kalām ʿalā Ummahāt al-Awlād min al-Minhāj",
          "label": "Fayḍ al-Jūd bi-Kalām ʿalā Ummahāt al-Awlād min al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1014,
          "author": "al-Ṭablāwī"
        },
        {
          "id": "Khatm al-Minhāj",
          "label": "Khatm al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1025,
          "author": "al-Danūsharī"
        },
        {
          "id": "Sharḥ Minhāj al-Ṭālibīn [li-l-Faraḍī]",
          "label": "Sharḥ Minhāj al-Ṭālibīn [li-l-Faraḍī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1028,
          "author": "al-Faraḍī"
        },
        {
          "id": "al-Dībāj ʿalā al-Minhāj",
          "label": "al-Dībāj ʿalā al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1041,
          "author": "Ibn Muṭayr ʿAlī"
        },
        {
          "id": "Sharḥ al-Minhāj [li-Nūr al-Dīn al-Ḥalabī]",
          "label": "Sharḥ al-Minhāj [li-Nūr al-Dīn al-Ḥalabī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1044,
          "author": "Nūr al-Dīn al-Ḥalabī"
        },
        {
          "id": "Bughyat al-Muḥtāj ilā Farāʾiḍ al-Minhāj",
          "label": "Bughyat al-Muḥtāj ilā Farāʾiḍ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1071,
          "author": "al-ʿUrḍī "
        },
        {
          "id": "Sharḥ Minhāj al-Ṭālibīn [li-l-Dāwūdī]",
          "label": "Sharḥ Minhāj al-Ṭālibīn [li-l-Dāwūdī]",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1168,
          "author": "al-Dāwūdī "
        },
        {
          "id": "al-Sirāj al-Wahhāj",
          "label": "al-Sirāj al-Wahhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1189,
          "author": "al-Najātī"
        },
        {
          "id": "Tuḥfat al-Ḥabīb ʿalā Sharḥ al-Khaṭīb",
          "label": "Tuḥfat al-Ḥabīb ʿalā Sharḥ al-Khaṭīb",
          "parents": [
            "al-Iqnāʿ fī Ḥall Alfāẓ Abī Shujāʿ"
          ],
          "death": 1221,
          "author": "al-Bujayramī"
        },
        {
          "id": "Irshād al-Rāghibīn fī Sharḥ Muqaddimat Minhāj al-Ṭālibīn",
          "label": "Irshād al-Rāghibīn fī Sharḥ Muqaddimat Minhāj al-Ṭālibīn",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1298,
          "author": "al-Ahdal"
        },
        {
          "id": "Ḥāshiyat Iʿānat al-Ṭālibīn ʿalā Ḥall Alfāẓ Fatḥ al-Muʿīn bi-Sharḥ Qurrat al-ʿAyn bi-Muhimmāt al-Dīn",
          "label": "Ḥāshiyat Iʿānat al-Ṭālibīn ʿalā Ḥall Alfāẓ Fatḥ al-Muʿīn bi-Sharḥ Qurrat al-ʿAyn bi-Muhimmāt al-Dīn",
          "parents": [
            "Fatḥ al-Muʿīn bi-Sharḥ Qurrat al-ʿAyn bi-Muhimmāt al-Dīn"
          ],
          "death": 1310,
          "author": "al-Bakrī al-Dimyāṭī"
        },
        {
          "id": "Nihāyat al-Zayn fī Irshād al-Mubtadiʾīn",
          "label": "Nihāyat al-Zayn fī Irshād al-Mubtadiʾīn",
          "parents": [
            "Fatḥ al-Muʿīn bi-Sharḥ Qurrat al-ʿAyn bi-Muhimmāt al-Dīn"
          ],
          "death": 1316,
          "author": "al-Jāwī"
        },
        {
          "id": "al-Sirāj al-Wahhāj Sharḥ al-Minhāj",
          "label": "al-Sirāj al-Wahhāj Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1338,
          "author": "al-Ghamrāwī"
        },
        {
          "id": "Zād al-Muḥtāj fī Sharḥ al-Minhāj",
          "label": "Zād al-Muḥtāj fī Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1340,
          "author": "al-Kūhajī"
        },
        {
          "id": "al-Ibtihāj fī Iṣṭilāḥ al-Minhāj",
          "label": "al-Ibtihāj fī Iṣṭilāḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1343,
          "author": "Ibn Sumayṭ"
        },
        {
          "id": "Luqtat al-Muḥtāj li-Qurrāʾ Khuṭbat al-Minhāj",
          "label": "Luqtat al-Muḥtāj li-Qurrāʾ Khuṭbat al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1360,
          "author": "al-Ḥalabī "
        },
        {
          "id": "Taqrīr al-Marṣafī ʿalā al-Minhāj",
          "label": "Taqrīr al-Marṣafī ʿalā al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1370,
          "author": "al-Marṣafī"
        },
        {
          "id": "Mukhtaṣar al-Majmūʿ",
          "label": "Mukhtaṣar al-Majmūʿ",
          "parents": [
            "al-Majmūʿ Sharḥ al-Muhadhdhab"
          ],
          "death": 1370,
          "author": "Sālim al-Rāfiʿī"
        },
        {
          "id": "Sullam al-Mutaʿallim al-Muḥtāj bi-Rumūz al-Minhāj",
          "label": "Sullam al-Mutaʿallim al-Muḥtāj bi-Rumūz al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 1390,
          "author": "Shamīla al-Ahdal"
        },
        {
          "id": "Hādī al-Muḥtāj ilā Sharḥ al-Minhāj",
          "label": "Hādī al-Muḥtāj ilā Sharḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 9999,
          "author": "Unknown A"
        },
        {
          "id": "Miṣbāḥ al-Muḥtāj ilā Mā fī al-Minhāj",
          "label": "Miṣbāḥ al-Muḥtāj ilā Mā fī al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 9999,
          "author": "Unknown D"
        },
        {
          "id": "Kashf al-Muḥtāj ilā Tawḍīḥ al-Minhāj",
          "label": "Kashf al-Muḥtāj ilā Tawḍīḥ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 9999,
          "author": "Unknown C"
        },
        {
          "id": "al-Muḥtāj ilā Ḥall Alfāẓ al-Minhāj",
          "label": "al-Muḥtāj ilā Ḥall Alfāẓ al-Minhāj",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 9999,
          "author": "Unknown E"
        },
        {
          "id": "Iʿānat al-Nabīh limā Zāda ʿan al-Minhāj min al-Ḥāwī wa-l-Bahja wa-l-Tanbīh",
          "label": "Iʿānat al-Nabīh limā Zāda ʿan al-Minhāj min al-Ḥāwī wa-l-Bahja wa-l-Tanbīh",
          "parents": [
            "Minhāj al-Ṭālibīn wa-ʿUmdat al-Muftīn"
          ],
          "death": 9999,
          "author": "Unknown B"
        }
      ],
      [
        {
          "id": "al-Durr al-Wahhāj Sharḥ Daqāʾiq al-Minhāj",
          "label": "al-Durr al-Wahhāj Sharḥ Daqāʾiq al-Minhāj",
          "parents": [
            "Daqāʾiq al-Minhāj"
          ],
          "death": 676,
          "author": "al-Nawawī"
        },
        {
          "id": "Iyḍāḥ al-Irtiyāb fī Maʿrifat Mā Yashtabih min al-Asmāʾ wa-l-Ansāb wa-l-Alfāẓ wa-l-Kunā wa-l-Alqāb al-Wāqiʿa fī Tuḥfat al-Muḥtāj ilā Aḥādīth al-Minhāj",
          "label": "Iyḍāḥ al-Irtiyāb fī Maʿrifat Mā Yashtabih min al-Asmāʾ wa-l-Ansāb wa-l-Alfāẓ wa-l-Kunā wa-l-Alqāb al-Wāqiʿa fī Tuḥfat al-Muḥtāj ilā Aḥādīth al-Minhāj",
          "parents": [
            "Tuḥfat al-Muḥtāj ilā Adillat al-Minhāj"
          ],
          "death": 804,
          "author": "Ibn al-Mulaqqin"
        },
        {
          "id": "al-Mulimmāt ʿalā al-Muhimmāt",
          "label": "al-Mulimmāt ʿalā al-Muhimmāt",
          "parents": [
            "al-Muhimmāt ʿalā al-Rawḍa"
          ],
          "death": 805,
          "author": "Sirāj al-Dīn al-Bulqīnī "
        },
        {
          "id": "Muhimmāt al-Muhimmāt",
          "label": "Muhimmāt al-Muhimmāt",
          "parents": [
            "al-Muhimmāt ʿalā al-Rawḍa"
          ],
          "death": 806,
          "author": "al-Ḥāfiẓ al-ʿIrāqī"
        },
        {
          "id": "al-Taʿaqqubāt ʿalā al-Muhimmāt",
          "label": "al-Taʿaqqubāt ʿalā al-Muhimmāt",
          "parents": [
            "al-Muhimmāt ʿalā al-Rawḍa"
          ],
          "death": 808,
          "author": "Ibn ʿImād "
        },
        {
          "id": "Sharḥ Daqāʾiq al-Minhāj",
          "label": "Sharḥ Daqāʾiq al-Minhāj",
          "parents": [
            "Daqāʾiq al-Minhāj"
          ],
          "death": 834,
          "author": "Ibn Khaṭīb al-Dahsha"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-l-Miṣrī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-l-Miṣrī]",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 862,
          "author": " al-Miṣrī"
        },
        {
          "id": "ʿAyyināt al-Muʿallimāt bi-l-Iʿrāḍāt ʿalā al-Muhimmāt",
          "label": "ʿAyyināt al-Muʿallimāt bi-l-Iʿrāḍāt ʿalā al-Muhimmāt",
          "parents": [
            "al-Muhimmāt ʿalā al-Rawḍa"
          ],
          "death": 864,
          "author": "al-Ṭarābulsī"
        },
        {
          "id": "Ḥusn al-Ibtihāj Sharḥ al-Minhāj",
          "label": "Ḥusn al-Ibtihāj Sharḥ al-Minhāj",
          "parents": [
            "al-Ibtihāj Sharḥ al-Minhāj"
          ],
          "death": 864,
          "author": "al-Maḥallī"
        },
        {
          "id": "al-Masāʾil al-Muʿallimāt bi-l-Iʿrāḍāt ʿalā al-Muhimmāt",
          "label": "al-Masāʾil al-Muʿallimāt bi-l-Iʿrāḍāt ʿalā al-Muhimmāt",
          "parents": [
            "al-Muhimmāt ʿalā al-Rawḍa"
          ],
          "death": 874,
          "author": "Ibn Qāḍī Shuhba"
        },
        {
          "id": "Sharḥ al-Manhaj [li-Mullā Ḥasan Shalabī]",
          "label": "Sharḥ al-Manhaj [li-Mullā Ḥasan Shalabī]",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 886,
          "author": "Mullā Ḥasan Shalabī"
        },
        {
          "id": "al-Ibtihāj bi-Ḥawāshī al-Minhāj ʿalā Sharḥ al-Maḥallī",
          "label": "al-Ibtihāj bi-Ḥawāshī al-Minhāj ʿalā Sharḥ al-Maḥallī",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 891,
          "author": "al-Jalāl al-Bakrī"
        },
        {
          "id": "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb",
          "label": "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 926,
          "author": "al-Anṣārī"
        },
        {
          "id": "Asnā al-Maṭālib",
          "label": "Asnā al-Maṭālib",
          "parents": [
            "Rawd al-Ṭālib"
          ],
          "death": 926,
          "author": "al-Anṣārī"
        },
        {
          "id": "Sharḥ al-ʿْUbāb",
          "label": "Sharḥ al-ʿْUbāb",
          "parents": [
            "al-ʿUbāb al-Muḥīṭ bi-Muʿẓam Nuṣūṣ al-Shāfiʿī wa-l-Aṣḥāb (Mukhtasar al-Rawḍa)"
          ],
          "death": 933,
          "author": " Ibn ʿIrāq"
        },
        {
          "id": "Hādī al-Muḥaqqiq Ḥāshiya ʿalā Sharḥ al-Maḥallī",
          "label": "Hādī al-Muḥaqqiq Ḥāshiya ʿalā Sharḥ al-Maḥallī",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 952,
          "author": "Abū al-Ḥasan al-Bakrī"
        },
        {
          "id": "Ḥāshiya ʿalā Tuḥfat al-Muḥtāj [li-ʿAmīra]",
          "label": "Ḥāshiya ʿalā Tuḥfat al-Muḥtāj [li-ʿAmīra]",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 957,
          "author": " ʿAmīra "
        },
        {
          "id": "Ḥāshiya ʿalā Kanz al-Rāghibīn Sharḥ Minhāj al-Ṭālibīn",
          "label": "Ḥāshiya ʿalā Kanz al-Rāghibīn Sharḥ Minhāj al-Ṭālibīn",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 957,
          "author": " ʿAmīra "
        },
        {
          "id": "Ḥāshiyat al-Ramlī ʿalā Asnā al-Maṭālib",
          "label": "Ḥāshiyat al-Ramlī ʿalā Asnā al-Maṭālib",
          "parents": [
            "Rawd al-Ṭālib"
          ],
          "death": 957,
          "author": "Shihāb al-Dīn al-Ramlī"
        },
        {
          "id": "al-Ṭirāz al-Abhaj ʿalā Khuṭbat al-Manhaj [li-l-Shaʿrānī]",
          "label": "al-Ṭirāz al-Abhaj ʿalā Khuṭbat al-Manhaj [li-l-Shaʿrānī]",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 973,
          "author": "al-Shaʿrānī"
        },
        {
          "id": "Ifshāʾ al-Sirr al-Maṣūn min Ḍamīr Taṣḥīḥ Ibn Qāḍī ʿAjlūn",
          "label": "Ifshāʾ al-Sirr al-Maṣūn min Ḍamīr Taṣḥīḥ Ibn Qāḍī ʿAjlūn",
          "parents": [
            "Mughnī al-Rāghibīn bi-Taṣḥīḥ Minhāj al-Ṭālibīn"
          ],
          "death": 973,
          "author": "Ibn al-Muwaqqiʿ"
        },
        {
          "id": "al-Iyʿāb Sharḥ al-ʿUbāb",
          "label": "al-Iyʿāb Sharḥ al-ʿUbāb",
          "parents": [
            "al-ʿUbāb al-Muḥīṭ bi-Muʿẓam Nuṣūṣ al-Shāfiʿī wa-l-Aṣḥāb (Mukhtasar al-Rawḍa)"
          ],
          "death": 974,
          "author": "Ibn Ḥajar al-Haytamī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ Taṣḥīḥ al-Minhāj al-Musammā bi-l-Mughnī",
          "label": "Ḥāshiya ʿalā Sharḥ Taṣḥīḥ al-Minhāj al-Musammā bi-l-Mughnī",
          "parents": [
            "Mughnī al-Rāghibīn bi-Taṣḥīḥ Minhāj al-Ṭālibīn"
          ],
          "death": 976,
          "author": "al-ʿAythāwī"
        },
        {
          "id": "Ḥāshiya Ibn Qāsim ʿalā Tuḥfat al-Muḥtāj",
          "label": "Ḥāshiya Ibn Qāsim ʿalā Tuḥfat al-Muḥtāj",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 992,
          "author": "Ibn Qāsim al-ʿAbbādī"
        },
        {
          "id": "Ḥāshiya ʿalā Kanz al-Rāghibīn",
          "label": "Ḥāshiya ʿalā Kanz al-Rāghibīn",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 992,
          "author": "Ibn Qāsim al-ʿAbbādī"
        },
        {
          "id": "Ḥāshiya ʿalā al-ʿUbāb",
          "label": "Ḥāshiya ʿalā al-ʿUbāb",
          "parents": [
            "al-ʿUbāb al-Muḥīṭ bi-Muʿẓam Nuṣūṣ al-Shāfiʿī wa-l-Aṣḥāb (Mukhtasar al-Rawḍa)"
          ],
          "death": 992,
          "author": "Ibn Qāsim al-ʿAbbādī"
        },
        {
          "id": "Ḥāshiya ʿalā Ḥāshiyat al-Jalāl al-Maḥallī",
          "label": "Ḥāshiya ʿalā Ḥāshiyat al-Jalāl al-Maḥallī",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 995,
          "author": "al-Sunbāṭī"
        },
        {
          "id": "Ḥāshiya ʿalā al-ʿUbāb (Fatḥ al-Malik al-Wahhāb)",
          "label": "Ḥāshiya ʿalā al-ʿUbāb (Fatḥ al-Malik al-Wahhāb)",
          "parents": [
            "al-ʿUbāb al-Muḥīṭ bi-Muʿẓam Nuṣūṣ al-Shāfiʿī wa-l-Aṣḥāb (Mukhtasar al-Rawḍa)"
          ],
          "death": 1004,
          "author": "Shams al-Dīn al-Ramlī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-l-Ṭablāwī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-l-Ṭablāwī]",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 1014,
          "author": "al-Ṭablāwī"
        },
        {
          "id": "al-Kashf al-Mujallī fī al-Kalām ʿalā al-Minhāj wa-l-Shāriḥ al-Maḥallī",
          "label": "al-Kashf al-Mujallī fī al-Kalām ʿalā al-Minhāj wa-l-Shāriḥ al-Maḥallī",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 1014,
          "author": "al-Munayrī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-l-Ziyādī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-l-Ziyādī]",
          "parents": [
            "Nihāyat (Ghāyat) al-Muḥtāj bi-Sharḥ al-Minhāj"
          ],
          "death": 1024,
          "author": "al-Ziyādī"
        },
        {
          "id": "Sharḥ Mukhtaṣar al-Minhāj li-l-Ramlī",
          "label": "Sharḥ Mukhtaṣar al-Minhāj li-l-Ramlī",
          "parents": [
            "Nihāyat (Ghāyat) al-Muḥtāj bi-Sharḥ al-Minhāj"
          ],
          "death": 1028,
          "author": "al-Faraḍī"
        },
        {
          "id": "Isʿāf al-Ṭullāb bi-Sharḥ al-ʿUbāb",
          "label": "Isʿāf al-Ṭullāb bi-Sharḥ al-ʿUbāb",
          "parents": [
            "al-ʿUbāb al-Muḥīṭ bi-Muʿẓam Nuṣūṣ al-Shāfiʿī wa-l-Aṣḥāb (Mukhtasar al-Rawḍa)"
          ],
          "death": 1031,
          "author": "al-Munāwī"
        },
        {
          "id": "Ḥāshiya ʿalā al-Tuḥfa",
          "label": "Ḥāshiya ʿalā al-Tuḥfa",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1037,
          "author": "al-Baṣrī"
        },
        {
          "id": "al-Intihāf fī Ikhtiṣār al-Tuḥfa",
          "label": "al-Intihāf fī Ikhtiṣār al-Tuḥfa",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1041,
          "author": "Ibn Muṭayr ʿAlī"
        },
        {
          "id": "Ḥawāshī ʿalā Sharḥ al-Maḥallī",
          "label": "Ḥawāshī ʿalā Sharḥ al-Maḥallī",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 1069,
          "author": "al-Khaṭīb al-Shūbarī"
        },
        {
          "id": "Ḥāshiyat al-Qalyūbī ʿalā Sharḥ al-Jalāl al-Maḥallī ʿalā al-Minhāj",
          "label": "Ḥāshiyat al-Qalyūbī ʿalā Sharḥ al-Jalāl al-Maḥallī ʿalā al-Minhāj",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 1069,
          "author": "al-Qalyūbī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-ʿAbd al-Barr al-Ajhūrī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-ʿAbd al-Barr al-Ajhūrī]",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 1070,
          "author": "ʿAbd al-Barr al-Ajhūrī "
        },
        {
          "id": "Ḥāshiya ʿalā Nihāyat al-Muḥtāj",
          "label": "Ḥāshiya ʿalā Nihāyat al-Muḥtāj",
          "parents": [
            "Nihāyat (Ghāyat) al-Muḥtāj bi-Sharḥ al-Minhāj"
          ],
          "death": 1087,
          "author": "al-Shubrāmilsī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Ramlī",
          "label": "Ḥāshiya ʿalā Sharḥ al-Ramlī",
          "parents": [
            "Nihāyat (Ghāyat) al-Muḥtāj bi-Sharḥ al-Minhāj"
          ],
          "death": 1096,
          "author": "al-Maghribī ar-Rashīdī"
        },
        {
          "id": "Kashf al-Ḥijāb wa-Lubb al-Lubāb Mukhtaṣar Sharḥ al-Manhaj",
          "label": "Kashf al-Ḥijāb wa-Lubb al-Lubāb Mukhtaṣar Sharḥ al-Manhaj",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 1100,
          "author": "Abū Rāḍī"
        },
        {
          "id": "Ḥāshiya[t al-Ḥusayn Ābādī] ʿalā Bāb al-Farāʾiḍ min Tuḥfat al-Muḥtāj li-Ibn Ḥajar",
          "label": "Ḥāshiya[t al-Ḥusayn Ābādī] ʿalā Bāb al-Farāʾiḍ min Tuḥfat al-Muḥtāj li-Ibn Ḥajar",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1107,
          "author": "al-Ḥusayn Ābādī"
        },
        {
          "id": "al-Ṭirāz al-Abhaj ʿalā Khuṭbat al-Manhaj [li-l-Malwī]",
          "label": "al-Ṭirāz al-Abhaj ʿalā Khuṭbat al-Manhaj [li-l-Malwī]",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 1181,
          "author": "al-Malwī"
        },
        {
          "id": "Sharḥ ʿalā Manhaj al-Ṭullāb",
          "label": "Sharḥ ʿalā Manhaj al-Ṭullāb",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 1189,
          "author": "al-Shibīnī"
        },
        {
          "id": "Sharḥ al-Sirāj al-Wahhāj (Mukhtaṣar Nihāyat al-Muḥtāj)",
          "label": "Sharḥ al-Sirāj al-Wahhāj (Mukhtaṣar Nihāyat al-Muḥtāj)",
          "parents": [
            "Nihāyat (Ghāyat) al-Muḥtāj bi-Sharḥ al-Minhāj"
          ],
          "death": 1189,
          "author": "al-Khalīlī"
        },
        {
          "id": "Mukhtaṣar al-Manhaj",
          "label": "Mukhtaṣar al-Manhaj",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 1189,
          "author": "al-Shibīnī"
        },
        {
          "id": "ʿUqūd al-Durr fī Bayān Muṣṭalaḥāt Tuḥfat Ibn Ḥajar",
          "label": "ʿUqūd al-Durr fī Bayān Muṣṭalaḥāt Tuḥfat Ibn Ḥajar",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1194,
          "author": "al-Kurdī"
        },
        {
          "id": "Kashf al-Niqāb ʿalā Manhaj al-Ṭullāb",
          "label": "Kashf al-Niqāb ʿalā Manhaj al-Ṭullāb",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 1211,
          "author": "al-Wanāʾī al-Miṣrī"
        },
        {
          "id": "Nahj al-Ṭālib li-Ashraf al-Maṭālib",
          "label": "Nahj al-Ṭālib li-Ashraf al-Maṭālib",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 1215,
          "author": "al-Jawharī al-Ṣaghīr"
        },
        {
          "id": "Ḥāshiya[t al-Ḥaydarī] ʿalā Bāb al-Farāʾiḍ min Tuḥfat al-Muḥtāj li-Ibn Ḥajar",
          "label": "Ḥāshiya[t al-Ḥaydarī] ʿalā Bāb al-Farāʾiḍ min Tuḥfat al-Muḥtāj li-Ibn Ḥajar",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1233,
          "author": "al-Ḥaydarī"
        },
        {
          "id": "Ḥāshiya ʿalā Tuḥfat al-Muḥtāj [li-Ibn al-Qā’id]",
          "label": "Ḥāshiya ʿalā Tuḥfat al-Muḥtāj [li-Ibn al-Qā’id]",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1235,
          "author": "Ibn al-Qā’id"
        },
        {
          "id": "al-Sirāj al-Wahhāj Ḥāshiya ʿalā Tuḥfat al-Muḥtāj",
          "label": "al-Sirāj al-Wahhāj Ḥāshiya ʿalā Tuḥfat al-Muḥtāj",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1255,
          "author": "al-Mazūrī "
        },
        {
          "id": "Sharḥ Farāʾiḍ al-Tuḥfa li-Ibn Ḥajar",
          "label": "Sharḥ Farāʾiḍ al-Tuḥfa li-Ibn Ḥajar",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1260,
          "author": "al-Bālakī"
        },
        {
          "id": "Aqsā al-Rawāj li-Tuḥfat al-Muḥtāj",
          "label": "Aqsā al-Rawāj li-Tuḥfat al-Muḥtāj",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1272,
          "author": "al-Barzinjī"
        },
        {
          "id": "al-Rasāʾil al-Dhahabiyya fī Masāʾil al-Daqīqa al-Manhajiyya",
          "label": "al-Rasāʾil al-Dhahabiyya fī Masāʾil al-Daqīqa al-Manhajiyya",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 1280,
          "author": "Muṣṭafā al-Dhahabī"
        },
        {
          "id": "Ḥāshiya ʿalā Farāʾiḍ al-Tuḥfa",
          "label": "Ḥāshiya ʿalā Farāʾiḍ al-Tuḥfa",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1288,
          "author": "al-Khaṭīb"
        },
        {
          "id": "Tadhkirat al-Ikhwān fī Sharḥ Muṣṭalaḥāt al-Tuḥfa",
          "label": "Tadhkirat al-Ikhwān fī Sharḥ Muṣṭalaḥāt al-Tuḥfa",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1300,
          "author": "al-Qalhātī"
        },
        {
          "id": "Ḥāshiyat al-Sharwānī ʿalā Tuḥfat al-Muḥtāj",
          "label": "Ḥāshiyat al-Sharwānī ʿalā Tuḥfat al-Muḥtāj",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 1301,
          "author": "al-Sharwānī"
        },
        {
          "id": "Taqrīr al-Anbābī ʿalā Nihāyat al-Muḥtāj li-l-Ramlī",
          "label": "Taqrīr al-Anbābī ʿalā Nihāyat al-Muḥtāj li-l-Ramlī",
          "parents": [
            "Nihāyat (Ghāyat) al-Muḥtāj bi-Sharḥ al-Minhāj"
          ],
          "death": 1313,
          "author": "al-Anbābī"
        },
        {
          "id": "Fatḥ al-Wahhāb Ḥāshiya ʿalā Manhaj al-Ṭullāb",
          "label": "Fatḥ al-Wahhāb Ḥāshiya ʿalā Manhaj al-Ṭullāb",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 1334,
          "author": "Ibn Khamīs"
        },
        {
          "id": "Mukhtaṣar Tuḥfat al-Muḥtāj bi-Sharḥ al-Minhāj",
          "label": "Mukhtaṣar Tuḥfat al-Muḥtāj bi-Sharḥ al-Minhāj",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Ibn Ḥajar al-Haytamī]"
          ],
          "death": 1397,
          "author": "Ibn Sumīṭ"
        },
        {
          "id": "Ḥāshiya ʿalā Dībājat Tuḥfat al-Muḥtāj",
          "label": "Ḥāshiya ʿalā Dībājat Tuḥfat al-Muḥtāj",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 9999,
          "author": "al-Bālī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-l-Minūfī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Minhāj [li-l-Minūfī]",
          "parents": [
            "Kanz al-Rāghibīn fī Sharḥ Minhāj al-Ṭālibīn [li-l-Maḥallī]"
          ],
          "death": 9999,
          "author": "al-Minūfī "
        },
        {
          "id": "Manhaj al-Rāghib Sharḥ Manhaj al-Ṭullāb",
          "label": "Manhaj al-Rāghib Sharḥ Manhaj al-Ṭullāb",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 9999,
          "author": "al-Maqdisī"
        },
        {
          "id": "Mukhtaṣar Tuḥfat al-Muḥtāj",
          "label": "Mukhtaṣar Tuḥfat al-Muḥtāj",
          "parents": [
            "Tuḥfat al-Muḥtāj Sharḥ al-Minhāj [li-Sharaf al-Dīn al-Ghazzī]"
          ],
          "death": 9999,
          "author": "al-Sanandajī"
        },
        {
          "id": "Tawḍīḥ Manhaj al-Ṭullāb",
          "label": "Tawḍīḥ Manhaj al-Ṭullāb",
          "parents": [
            "Manhaj al-Ṭullāb"
          ],
          "death": 9999,
          "author": "ʿAlī al-Maḥallī"
        }
      ],
      [
        {
          "id": "Mukhtaṣar al-Muhimmāt [li-l-ʿĀmirī]",
          "label": "Mukhtaṣar al-Muhimmāt [li-l-ʿĀmirī]",
          "parents": [
            "Muhimmāt al-Muhimmāt"
          ],
          "death": 822,
          "author": " al-ʿĀmirī "
        },
        {
          "id": "Mukhtaṣar al-Muhimmāt [li-Ibn al-ʿIrāqī]",
          "label": "Mukhtaṣar al-Muhimmāt [li-Ibn al-ʿIrāqī]",
          "parents": [
            "Muhimmāt al-Muhimmāt"
          ],
          "death": 826,
          "author": "Ibn al-ʿIrāqī"
        },
        {
          "id": "Muhimmāt al-Muhimmāt (Mukhtaṣar al-Muhimmāt)",
          "label": "Muhimmāt al-Muhimmāt (Mukhtaṣar al-Muhimmāt)",
          "parents": [
            "Muhimmāt al-Muhimmāt"
          ],
          "death": 887,
          "author": "al-Fatā al-Yamānī "
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-Ibn Qāsim al-ʿAbbādī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-Ibn Qāsim al-ʿAbbādī]",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 992,
          "author": "Ibn Qāsim al-ʿAbbādī"
        },
        {
          "id": "Ḥāshiyat al-Jawharī ʿalā Sharḥ Manhaj al-Ṭullāb al-Musammā Fatḥ al-Wahhāb",
          "label": "Ḥāshiyat al-Jawharī ʿalā Sharḥ Manhaj al-Ṭullāb al-Musammā Fatḥ al-Wahhāb",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1000,
          "author": "al-Jawharī al-Kabīr"
        },
        {
          "id": "Ḥāshiya ʿalā Fatḥ al-Wahhāb",
          "label": "Ḥāshiya ʿalā Fatḥ al-Wahhāb",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1014,
          "author": "al-Ṭablāwī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj (al-Durr al-Mubhij fī Ḥall ʿUqūd al-Manhaj)",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj (al-Durr al-Mubhij fī Ḥall ʿUqūd al-Manhaj)",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1024,
          "author": "al-Ziyādī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-Nūr al-Dīn al-Ḥalabī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-Nūr al-Dīn al-Ḥalabī]",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1044,
          "author": "Nūr al-Dīn al-Ḥalabī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-l-Khaṭīb al-Shūbarī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-l-Khaṭīb al-Shūbarī]",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1069,
          "author": "al-Khaṭīb al-Shūbarī"
        },
        {
          "id": "Ḥawāshī al-Rawḍ Jarradaha min Ḥawāshī Shaykhihi al-Ramlī al-Mārri Qablahu",
          "label": "Ḥawāshī al-Rawḍ Jarradaha min Ḥawāshī Shaykhihi al-Ramlī al-Mārri Qablahu",
          "parents": [
            "Ḥāshiyat al-Ramlī ʿalā Asnā al-Maṭālib"
          ],
          "death": 1069,
          "author": "al-Khaṭīb al-Shūbarī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-ʿAbd al-Barr al-Ajhūrī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-ʿAbd al-Barr al-Ajhūrī]",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1070,
          "author": "ʿAbd al-Barr al-Ajhūrī "
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj li-l-Shaykh Zakariyyā",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj li-l-Shaykh Zakariyyā",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1075,
          "author": "Sulṭān al-Mazzāḥī"
        },
        {
          "id": "Ḥāshiya Shubrāmilsī ʿalā Sharḥ Manhaj al-Ṭullāb",
          "label": "Ḥāshiya Shubrāmilsī ʿalā Sharḥ Manhaj al-Ṭullāb",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1087,
          "author": "al-Shubrāmilsī"
        },
        {
          "id": "al-Fatḥ al-Anhaj fī Sharḥ Sharḥ al-Manhaj",
          "label": "al-Fatḥ al-Anhaj fī Sharḥ Sharḥ al-Manhaj",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1100,
          "author": "Fatḥ Allāh al-Āmidī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj li-l-Shaykh Zakariyyā al-Anṣārī",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj li-l-Shaykh Zakariyyā al-Anṣārī",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1106,
          "author": "al-Birmāwī "
        },
        {
          "id": "Fatḥ al-Malik al-Bārī ʿalā Ākhir Sharḥ al-Minhāj li-l-Shaykh Zakariyyā al-Anṣārī",
          "label": "Fatḥ al-Malik al-Bārī ʿalā Ākhir Sharḥ al-Minhāj li-l-Shaykh Zakariyyā al-Anṣārī",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1151,
          "author": "al-Dīyarbī "
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-l-Dāwūdī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-l-Dāwūdī]",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1168,
          "author": "al-Dāwūdī "
        },
        {
          "id": "Natāʾij al-Albāb ʿalā Sharḥ Manhaj al-Ṭullāb",
          "label": "Natāʾij al-Albāb ʿalā Sharḥ Manhaj al-Ṭullāb",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1182,
          "author": "al-Barrāwī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-l-Ajhūrī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-l-Ajhūrī]",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1190,
          "author": "al-Ajhūrī"
        },
        {
          "id": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-l-ʿAjlūnī]",
          "label": "Ḥāshiya ʿalā Sharḥ al-Manhaj [li-l-ʿAjlūnī]",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1193,
          "author": "al-ʿAjlūnī"
        },
        {
          "id": "Futūḥāt al-Wahhāb bi-Tawḍīḥ Sharḥ Manhaj al-Ṭullāb",
          "label": "Futūḥāt al-Wahhāb bi-Tawḍīḥ Sharḥ Manhaj al-Ṭullāb",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1204,
          "author": "al-Jamal"
        },
        {
          "id": "Itḥāf al-Rāghib Sharḥ Nahj al-Ṭālib",
          "label": "Itḥāf al-Rāghib Sharḥ Nahj al-Ṭālib",
          "parents": [
            "Nahj al-Ṭālib li-Ashraf al-Maṭālib"
          ],
          "death": 1215,
          "author": "al-Jawharī al-Ṣaghīr"
        },
        {
          "id": "al-Tajrīd li-Nafʿ al-ʿAbīd (Ḥāshiya ʿalā Sharḥ al-Manhaj)",
          "label": "al-Tajrīd li-Nafʿ al-ʿAbīd (Ḥāshiya ʿalā Sharḥ al-Manhaj)",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 1221,
          "author": "al-Bujayramī"
        },
        {
          "id": "Mukhtaṣar al-Muhimmāt [li-l-Rawānī]",
          "label": "Mukhtaṣar al-Muhimmāt [li-l-Rawānī]",
          "parents": [
            "Muhimmāt al-Muhimmāt"
          ],
          "death": 9999,
          "author": "al-Rawānī"
        },
        {
          "id": "Ḥāshiya al-Iṭfīḥī ʿalā Sharḥ Manhaj al-Ṭullāb",
          "label": "Ḥāshiya al-Iṭfīḥī ʿalā Sharḥ Manhaj al-Ṭullāb",
          "parents": [
            "Fatḥ al-Wahhāb bi-Sharḥ Manhaj al-Ṭullāb"
          ],
          "death": 9999,
          "author": "al-Iṭfīḥī"
        }
      ],
      [
        {
          "id": "Ḥāshiya al-Shibīnī ʿalā Itḥāf al-Rāghib Sharḥ Nahj al-Ṭālib",
          "label": "Ḥāshiya al-Shibīnī ʿalā Itḥāf al-Rāghib Sharḥ Nahj al-Ṭālib",
          "parents": [
            "Itḥāf al-Rāghib Sharḥ Nahj al-Ṭālib"
          ],
          "death": 1200,
          "author": "al-Shabīnī"
        },
        {
          "id": "Ḥāshiya ʿalā Itḥāf al-Rāghib Sharḥ Nahj al-Ṭālib",
          "label": "Ḥāshiya ʿalā Itḥāf al-Rāghib Sharḥ Nahj al-Ṭālib",
          "parents": [
            "Itḥāf al-Rāghib Sharḥ Nahj al-Ṭālib"
          ],
          "death": 1234,
          "author": "al-Damlījī"
        }
      ]
    ]
  );
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
  const baseGenerationSpacing = 250;
  const minContentWidth = 1280;
  
  

  
  options.c ||= 16;
  const c = options.c;
  options.bigc ||= node_width+c;

  nodes.forEach(
    n => (n.height = (Math.max(1, n.bundles.length) - 1) * metro_d)
  );

  var x_offset = padding;
  var y_offset = padding;
  levels.forEach(l => {
    x_offset += l.bundles.length * bundle_width + baseGenerationSpacing;
    y_offset += level_y_padding;
    l.forEach((n, i) => {
      n.x = n.level * generationSpacing + x_offset;
      n.y = node_height + y_offset + n.height / 2;

      y_offset += node_height + n.height;
    });
  });

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

function _d3(require) { return require('d3-scale', 'd3-scale-chromatic', 'd3-array') }

function __(require) { return require("lodash") }

export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("title")).define(["md"], _1);
  main.variable(observer()).define(["renderChart", "data"], _2);
  main.variable(observer("codeHeader")).define(["md"], _3);
  main.variable(observer("renderChart")).define("renderChart", ["color", "constructTangleLayout", "_", "svg", "background_color"], _renderChart);
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
