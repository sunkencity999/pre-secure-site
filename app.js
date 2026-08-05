/* PRE Secure — public explainer interactions */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- scroll reveal ---------------- */
  var revealObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (el) { revealObs.observe(el); });

  /* ---------------- stat counters ---------------- */
  function animateCount(el) {
    var target = parseInt(el.dataset.count, 10);
    if (reduceMotion) { el.textContent = target; return; }
    var t0 = null, dur = 1100;
    function tick(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var countObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { animateCount(e.target); countObs.unobserve(e.target); }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll(".count").forEach(function (el) { countObs.observe(el); });

  /* ---------------- architecture tooltip ---------------- */
  var tip = document.getElementById("archTip");
  if (tip) {
    var frame = tip.parentElement;
    frame.querySelectorAll(".node[data-tip]").forEach(function (node) {
      node.addEventListener("mousemove", function (ev) {
        tip.hidden = false;
        tip.textContent = node.dataset.tip;
        var r = frame.getBoundingClientRect();
        var x = ev.clientX - r.left + 14;
        var y = ev.clientY - r.top + 14;
        if (x + 310 > r.width) x = r.width - 310;
        tip.style.left = x + "px";
        tip.style.top = y + "px";
      });
      node.addEventListener("mouseleave", function () { tip.hidden = true; });
      node.addEventListener("focus", function () {
        tip.hidden = false;
        tip.textContent = node.dataset.tip;
        tip.style.left = "20px";
        tip.style.top = "20px";
      });
    });
  }

  /* ---------------- audit-log helper ---------------- */
  function logLine(pre, obj, badKeys) {
    var parts = [];
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      var cls = (badKeys && badKeys.indexOf(k) !== -1) ? "jbad" : "jstr";
      var vs = typeof v === "string"
        ? '<span class="' + cls + '">"' + v + '"</span>'
        : '<span class="' + cls + '">' + v + "</span>";
      parts.push('<span class="jkey">"' + k + '"</span>:' + vs);
    });
    var line = document.createElement("span");
    line.className = "log-line";
    line.innerHTML = "{" + parts.join(",") + "}\n";
    pre.appendChild(line);
    pre.scrollTop = pre.scrollHeight;
  }

  /* ---------------- request-flow stepper ---------------- */
  var FLOW_STEPS = [
    {
      lanes: ["user"], edges: [0],
      title: "1 · The user asks for something real",
      body: "“Install the client library and run the integration script.” Sent over HTTPS — the app itself listens only on loopback; nginx is the sole network-facing door."
    },
    {
      lanes: ["nginx", "app"], edges: [1],
      title: "2 · TLS terminates, tenancy resolves",
      body: "nginx proxies the WebSocket to the app, which binds the request to exactly one user and one team. Every downstream action inherits this identity — attribution is structural, not best-effort."
    },
    {
      lanes: ["app", "model"], edges: [2, 3],
      title: "3 · The model reasons — and asks for a shell",
      body: "The team's configured model (local or self-hosted — never a third-party vendor) responds with a tool call: bash(“pip install requests && python integrate.py”). The model has no shell. It can only ask."
    },
    {
      lanes: ["gw"], edges: [4],
      title: "4 · The gateway brokers, never executes",
      body: "The exec gateway looks up this user's sandbox. Paused from an hour ago? Resumed in ~39ms. None yet? Quota is checked first, then one is started. The gateway itself runs no user-influenced command — it only decides which sandbox."
    },
    {
      lanes: ["vm"], vmSandbox: true, edges: [5],
      title: "5 · The command runs — on a machine that never mattered",
      body: "Inside the user's Firecracker microVM: separate kernel, own disk, private-range network egress blocked. Packages installed last week are still there. The host is not reachable from here.",
      log: { ts: "2026-08-05T14:12:07Z", user: "u_47ac", sandbox: "sb_9fe2", cmd: "pip install requests && python integrate.py", ms: 8412, ok: true }
    },
    {
      lanes: ["gw"], edges: [],
      title: "6 · The evidence writes itself",
      body: "Before the result goes anywhere, the gateway appends a JSONL entry: who, which sandbox, the exact command, duration, outcome. Success or failure — every exec call is logged. That's the line you just saw appear. →",
      log: { ts: "2026-08-05T14:12:16Z", user: "u_47ac", sandbox: "sb_9fe2", event: "pause_scheduled", idle_after_s: 1800 }
    },
    {
      lanes: ["user", "app", "model"], edges: [0, 1, 2, 3], back: true,
      title: "7 · The answer streams home",
      body: "Output returns to the model, the model finishes reasoning, and the answer streams back over the same TLS channel. Total host filesystem access by the agent: zero."
    }
  ];

  var lanes = document.querySelectorAll(".lane");
  var arrows = document.querySelectorAll(".lane-arrow");
  var flowDesc = document.getElementById("flowDesc");
  var flowLabel = document.getElementById("flowStepLabel");
  var auditPre = document.getElementById("auditLog");
  var flowIdx = -1, flowTimer = null, loggedSteps = {};

  function setFlowStep(i) {
    flowIdx = i;
    var step = FLOW_STEPS[i];
    lanes.forEach(function (l) {
      l.classList.toggle("active", step.lanes.indexOf(l.dataset.lane) !== -1 && !(step.vmSandbox && l.dataset.lane === "vm"));
      l.classList.toggle("sandbox-active", !!step.vmSandbox && l.dataset.lane === "vm");
    });
    arrows.forEach(function (a) {
      var on = step.edges.indexOf(parseInt(a.dataset.edge, 10)) !== -1;
      a.classList.toggle("active", on && !step.back);
      a.classList.toggle("back", on && !!step.back);
      a.textContent = (on && step.back) ? "←" : "→";
    });
    flowDesc.innerHTML = "<strong>" + step.title + "</strong>" + step.body;
    flowLabel.textContent = (i + 1) + " / " + FLOW_STEPS.length;
    if (step.log && !loggedSteps[i]) {
      loggedSteps[i] = true;
      logLine(auditPre, step.log);
    }
  }

  function stopAutoplay() {
    if (flowTimer) { clearInterval(flowTimer); flowTimer = null; }
    var b = document.getElementById("flowPlay");
    if (b) b.textContent = "▶ Auto-play";
  }

  var btnNext = document.getElementById("flowNext");
  if (btnNext) {
    btnNext.addEventListener("click", function () {
      stopAutoplay();
      setFlowStep((flowIdx + 1) % FLOW_STEPS.length);
    });
    document.getElementById("flowPrev").addEventListener("click", function () {
      stopAutoplay();
      setFlowStep((flowIdx - 1 + FLOW_STEPS.length) % FLOW_STEPS.length);
    });
    document.getElementById("flowPlay").addEventListener("click", function () {
      if (flowTimer) { stopAutoplay(); return; }
      this.textContent = "⏸ Pause";
      setFlowStep((flowIdx + 1) % FLOW_STEPS.length);
      flowTimer = setInterval(function () {
        setFlowStep((flowIdx + 1) % FLOW_STEPS.length);
      }, 4200);
    });
    setFlowStep(0);
  }

  /* ---------------- lifecycle token ---------------- */
  var lifeToken = document.getElementById("lifeToken");
  if (lifeToken) {
    var STATES = [
      { x: 125, y: 125, state: 0, edge: null },
      { x: 415, y: 125, state: 1, edge: 0 },   // start → running
      { x: 415, y: 125, state: 1, edge: null }, // exec dwell
      { x: 705, y: 125, state: 2, edge: 1 },   // idle → paused
      { x: 415, y: 125, state: 1, edge: 2 }    // resume
    ];
    var li = 0;
    var lstates = document.querySelectorAll(".lstate");
    var ledges = document.querySelectorAll(".ledge");
    function lifeTick() {
      var s = STATES[li];
      lifeToken.setAttribute("cx", s.x);
      lifeToken.setAttribute("cy", s.y - 60);
      lstates.forEach(function (el) { el.classList.toggle("active", parseInt(el.dataset.state, 10) === s.state); });
      ledges.forEach(function (el) { el.classList.toggle("active", s.edge !== null && parseInt(el.dataset.edge, 10) === s.edge); });
      li = (li + 1) % STATES.length;
      if (li === 0) li = 1; // after the intro, loop running↔paused
    }
    lifeToken.setAttribute("cx", 125);
    lifeToken.setAttribute("cy", 65);
    var lifeStarted = false;
    var lifeObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !lifeStarted) {
          lifeStarted = true;
          lifeTick();
          setInterval(lifeTick, reduceMotion ? 4000 : 1900);
          lifeObs.disconnect();
        }
      });
    }, { threshold: 0.4 });
    lifeObs.observe(lifeToken.closest(".viz-frame"));
  }

  /* ---------------- approval gate demo ---------------- */
  var gateStage = document.querySelector(".gate-stage");
  if (gateStage) {
    var gateToast = document.getElementById("gateToast");
    var gateLog = document.getElementById("gateLog");
    var gateResult = document.getElementById("gateResult");
    var btnA = document.getElementById("btnApprove");
    var btnD = document.getElementById("btnDeny");
    var btnR = document.getElementById("gateReset");
    var gateSeeded = false;

    var gateObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !gateSeeded) {
          gateSeeded = true;
          logLine(gateLog, { event: "request_created", by: "agent", cmd: "systemctl restart nginx", status: "pending" });
          gateObs.disconnect();
        }
      });
    }, { threshold: 0.3 });
    gateObs.observe(gateStage);

    function decide(approved) {
      btnA.disabled = btnD.disabled = true;
      gateToast.classList.add("decided");
      if (approved) {
        logLine(gateLog, { event: "request_approved", by: "admin:you", selfApproved: false });
        gateStage.classList.add("approved");
        setTimeout(function () {
          logLine(gateLog, { event: "request_enqueued", queue: "/var/lib/pre-runner/queue/pending" });
          gateStage.classList.add("executing");
        }, 900);
        setTimeout(function () {
          gateStage.classList.add("done");
          gateResult.textContent = "$ whoami → pre-runner\nexit 0 · nginx restarted · result merged back to team log";
          logLine(gateLog, { event: "request_result_recorded", exit: 0, ranAs: "pre-runner" });
          btnR.hidden = false;
        }, 2300);
      } else {
        gateStage.classList.add("denied");
        logLine(gateLog, { event: "request_denied", by: "admin:you", reason: "not right now" }, ["event"]);
        btnR.hidden = false;
      }
    }
    btnA.addEventListener("click", function () { decide(true); });
    btnD.addEventListener("click", function () { decide(false); });
    btnR.addEventListener("click", function () {
      gateStage.classList.remove("approved", "executing", "done", "denied");
      gateToast.classList.remove("decided");
      btnA.disabled = btnD.disabled = false;
      btnR.hidden = true;
      gateResult.textContent = "";
      gateLog.textContent = "";
      logLine(gateLog, { event: "request_created", by: "agent", cmd: "systemctl restart nginx", status: "pending" });
    });
  }

  /* ---------------- defense-in-depth tip ---------------- */
  var depthTip = document.getElementById("depthTip");
  if (depthTip) {
    document.querySelectorAll(".dlayer").forEach(function (layer) {
      function show() {
        document.querySelectorAll(".dlayer.sel").forEach(function (l) { l.classList.remove("sel"); });
        layer.classList.add("sel");
        depthTip.textContent = layer.dataset.stops;
      }
      layer.addEventListener("mouseenter", show);
      layer.addEventListener("click", show);
    });
  }

  /* ---------------- PII scrub demo ---------------- */
  var scrubBody = document.getElementById("scrubBody");
  if (scrubBody) {
    var SCRUB_HTML =
      '<span class="log-line">&gt; agent working — live session, PII allowed (the agent needs it):</span>' +
      '<span class="log-line">“<span class="pii" data-ph="&lt;PERSON_71ac73&gt;">Jane Doe</span> confirmed from <span class="pii" data-ph="&lt;LOCATION_eea3de&gt;">Santa Cruz</span> — emailed <span class="pii" data-ph="&lt;EMAIL_3f9a2c&gt;">jane.doe@example.com</span>, called <span class="pii" data-ph="&lt;PHONE_81d2e0&gt;">(415) 555-0132</span>.”</span>' +
      '<span class="log-line">“Card <span class="pii" data-ph="&lt;CARD_4b17aa&gt;">4111 1111 1111 1111</span> validated (Luhn) · payout IBAN <span class="pii" data-ph="&lt;IBAN_c92f10&gt;">DE89 3704 0044 0532 0130 00</span> (mod-97).”</span>' +
      '<span class="log-line">“Deployed against 10.0.4.22 — <span class="keep">internal IP, exempt: it’s infrastructure, not personal data</span>.”</span>' +
      '<span class="log-line scrub-status" id="scrubStatus"></span>';

    var scrubStarted = false;
    var scrubObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !scrubStarted) {
          scrubStarted = true;
          runScrubLoop();
          scrubObs.disconnect();
        }
      });
    }, { threshold: 0.3 });
    scrubObs.observe(scrubBody);

    function runScrubLoop() {
      scrubBody.innerHTML = SCRUB_HTML;
      var status = document.getElementById("scrubStatus");
      var piis = scrubBody.querySelectorAll(".pii");
      setTimeout(function () {
        status.innerHTML = "&gt; write to team memory requested → <span class='ok'>pii-scrub: crossing persistence boundary…</span>";
      }, reduceMotion ? 200 : 1800);
      piis.forEach(function (el, i) {
        setTimeout(function () {
          el.classList.add("scrubbed");
          el.textContent = el.dataset.ph.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        }, (reduceMotion ? 400 : 2800) + i * (reduceMotion ? 80 : 550));
      });
      setTimeout(function () {
        status.innerHTML = "&gt; write to team memory requested → <span class='ok'>scrubbed (Tier 1 checksums + Tier 2 NER) · placeholders are keyed HMACs — stable, typed, non-reversible · raw PII never hits disk</span>";
      }, reduceMotion ? 900 : 5600);
      setTimeout(runScrubLoop, reduceMotion ? 12000 : 11000);
    }
  }
})();
