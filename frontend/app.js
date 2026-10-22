const form = document.querySelector("#ambient-form");
const dialog = document.querySelector("#ambient-dialog");
const ambientList = document.querySelector("#ambient-list");
const loading = document.querySelector("#loading");
const emptyState = document.querySelector("#empty-state");
const feedback = document.querySelector("#feedback");
const dialogTitle = document.querySelector("#dialog-title");
const saveButton = document.querySelector("#save-button");
const programForm = document.querySelector("#program-form");
const programDialog = document.querySelector("#program-dialog");
const programList = document.querySelector("#program-list");
const programTableWrapper = document.querySelector("#program-table-wrapper");
const programLoading = document.querySelector("#program-loading");
const programEmptyState = document.querySelector("#program-empty-state");
const uploadButton = document.querySelector("#upload-button");
const processForm = document.querySelector("#process-form");
const processDialog = document.querySelector("#process-dialog");
const processAmbient = document.querySelector("#process-ambient");
const processProgram = document.querySelector("#process-program");
const createProcessButton = document.querySelector("#create-process-button");
const AMBIENT_DROPDOWN_STATE_KEY = "cloud-ambient-manager:ambient-dropdown-state";

let editingId = null;
let ambients = [];
let programs = [];
let processes = [];

function getOpenAmbientIds() {
  try {
    const savedState = JSON.parse(localStorage.getItem(AMBIENT_DROPDOWN_STATE_KEY) || "[]");
    return new Set(Array.isArray(savedState) ? savedState.map(Number) : []);
  } catch {
    return new Set();
  }
}

function saveOpenAmbientIds(openAmbientIds) {
  try {
    localStorage.setItem(AMBIENT_DROPDOWN_STATE_KEY, JSON.stringify([...openAmbientIds]));
  } catch {
    // The page still works when browser storage is unavailable.
  }
}

function errorMessage(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    return error
      .map((item) => (typeof item === "object" ? item.msg : item))
      .filter(Boolean)
      .join(" ");
  }
  if (error && typeof error === "object") {
    return error.detail ? errorMessage(error.detail, fallback) : fallback;
  }
  return fallback;
}

function showFeedback(message, type = "error") {
  feedback.textContent = message;
  feedback.className = `feedback feedback-${type}`;
  feedback.hidden = false;
}

function clearFeedback() {
  feedback.hidden = true;
}

function normalizeAmbient(row) {
  if (Array.isArray(row)) {
    const [id, name, cpuWeight, cpuMax, memoryMax, memorySwapMax, ioMax] = row;
    return { id, name, cpuWeight, cpuMax, memoryMax, memorySwapMax, ioMax };
  }

  return {
    id: row.id,
    name: row.name,
    cpuWeight: row.cpu_weight ?? row.cpuWeight,
    cpuMax: row.cpu_max ?? row.cpuMax,
    memoryMax: row.memory_max ?? row.memoryMax,
    memorySwapMax: row.memory_swap_max ?? row.memorySwapMax,
    ioMax: row.io_max ?? row.ioMax,
  };
}

function valueCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function renderAmbients(rows) {
  ambientList.replaceChildren();
  ambients = rows.map(normalizeAmbient);
  const openAmbientIds = getOpenAmbientIds();
  loading.hidden = true;
  emptyState.hidden = ambients.length !== 0;
  ambientList.hidden = ambients.length === 0;

  for (const ambient of ambients) {
    const details = document.createElement("details");
    details.className = "ambient-dropdown";
    details.open = openAmbientIds.has(Number(ambient.id));
    details.addEventListener("toggle", () => {
      if (details.open) {
        openAmbientIds.add(Number(ambient.id));
      } else {
        openAmbientIds.delete(Number(ambient.id));
      }
      saveOpenAmbientIds(openAmbientIds);
    });
    const summary = document.createElement("summary");
    const summaryInfo = document.createElement("span");
    summaryInfo.className = "ambient-summary-info";
    const name = document.createElement("span");
    name.className = "ambient-name";
    name.textContent = ambient.name;
    const resources = document.createElement("span");
    resources.className = "ambient-resources";
    resources.textContent = `CPU weight ${ambient.cpuWeight} · CPU máx. ${ambient.cpuMax} · Memória máx. ${ambient.memoryMax} · Swap máx. ${ambient.memorySwapMax} · I/O máx. ${ambient.ioMax}`;
    summaryInfo.append(name, resources);

    const actions = document.createElement("span");
    actions.className = "ambient-actions";
    const editButton = document.createElement("button");
    editButton.className = "action-button";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openEditDialog(ambient);
    });
    const deleteButton = document.createElement("button");
    deleteButton.className = "action-button action-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Apagar";
    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeAmbient(ambient);
    });
    actions.append(editButton, deleteButton);
    summary.append(summaryInfo, actions);
    details.append(summary);

    const processRows = document.createElement("div");
    processRows.className = "process-rows";
    const ambientProcesses = processes.filter((process) => process.ambientId === ambient.id);
    for (const process of ambientProcesses) {
      processRows.append(createProcessRow(process));
    }

    const addRow = document.createElement("button");
    addRow.className = "process-row process-add-row";
    addRow.type = "button";
    addRow.innerHTML = "<span class=\"plus-symbol\" aria-hidden=\"true\">+</span><span>Adicionar processo</span>";
    addRow.addEventListener("click", () => openProcessDialog(ambient.id));
    processRows.append(addRow);
    details.append(processRows);
    ambientList.append(details);
  }
}

function normalizeProcess(row) {
  if (Array.isArray(row)) {
    const [id, programsId, ambientId, status] = row;
    return { id, programId: programsId, ambientId, status };
  }
  return {
    id: row.id,
    programId: row.programs_id,
    ambientId: row.ambients_id,
    status: row.status,
  };
}

  // TODO: implementar a visualização dos logs do processo

function createProcessRow(process) {
  const row = document.createElement("div");
  row.className = "process-row";
  const program = programs.find((item) => item.id === process.programId);
  const name = document.createElement("span");
  name.textContent = program ? program.name : `Programa #${process.programId}`;
  name.className = "process-name";
  const status = document.createElement("span");
  status.textContent = process.status;
  status.className = `process-status status-${process.status}`;
  const deleteButton = document.createElement("button");
  deleteButton.className = "action-button action-danger";
  deleteButton.type = "button";
  deleteButton.textContent = "Excluir";
  deleteButton.addEventListener("click", () => removeProcess(process));
  row.append(name, status, deleteButton);
  return row;
}

async function loadAmbients() {
  clearFeedback();
  loading.hidden = false;
  ambientList.hidden = true;
  emptyState.hidden = true;

  try {
    const response = await fetch("/ambients");
    if (!response.ok) throw new Error("Não foi possível carregar os ambientes.");
    renderAmbients(await response.json());
  } catch (error) {
    loading.hidden = true;
    showFeedback(error.message);
  }
}

function openNewDialog() {
  editingId = null;
  dialogTitle.textContent = "Novo ambiente";
  saveButton.textContent = "Salvar ambiente";
  form.reset();
  dialog.showModal();
  form.elements.name.focus();
}

function openEditDialog(ambient) {
  editingId = ambient.id;
  dialogTitle.textContent = "Editar ambiente";
  saveButton.textContent = "Salvar alterações";
  form.elements.name.value = ambient.name;
  form.elements.cpu_weight.value = ambient.cpuWeight;
  form.elements.cpu_max.value = ambient.cpuMax;
  form.elements.memory_max.value = ambient.memoryMax;
  form.elements.memory_swap_max.value = ambient.memorySwapMax;
  form.elements.io_max.value = ambient.ioMax;
  dialog.showModal();
  form.elements.name.focus();
}

function openProcessDialog(ambientId) {
  processForm.reset();
  processAmbient.replaceChildren();
  for (const ambient of ambients) {
    const option = new Option(ambient.name, ambient.id);
    option.selected = ambient.id === ambientId;
    processAmbient.append(option);
  }

  processProgram.replaceChildren();
  for (const program of programs) {
    processProgram.append(new Option(program.name, program.id));
  }
  createProcessButton.disabled = programs.length === 0;
  processDialog.showModal();
}

function closeProcessDialog() {
  processDialog.close();
  processForm.reset();
}

function closeDialog() {
  dialog.close();
  form.reset();
}

function formParameters() {
  const data = new FormData(form);
  return new URLSearchParams(data);
}

async function saveAmbient(event) {
  event.preventDefault();
  saveButton.disabled = true;

  try {
    const parameters = formParameters();
    const path = editingId === null ? "/ambients" : `/ambients/${editingId}`;
    const endpoint = `${path}?${parameters.toString()}`;
    const response = await fetch(endpoint, {
      method: editingId === null ? "POST" : "PUT",
    });
    if (!response.ok) throw new Error("Não foi possível salvar o ambiente.");
    const successMessage = editingId === null ? "Ambiente criado." : "Ambiente atualizado.";
    closeDialog();
    await loadAmbients();
    showFeedback(successMessage, "success");
  } catch (error) {
    showFeedback(error.message);
  } finally {
    saveButton.disabled = false;
  }
}

async function removeAmbient(ambient) {
  if (!window.confirm(`Excluir o ambiente "${ambient.name}"?`)) return;

  try {
    const response = await fetch(`/ambients/${ambient.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Não foi possível excluir o ambiente.");
    await loadAmbients();
    showFeedback("Ambiente excluído.", "success");
  } catch (error) {
    showFeedback(error.message);
  }
}

function normalizeProgram(row) {
  if (Array.isArray(row)) {
    const [id, name] = row;
    return { id, name };
  }

  return { id: row.id, name: row.name };
}

function renderPrograms(rows) {
  programList.replaceChildren();
  const programs = rows.map(normalizeProgram);
  programLoading.hidden = true;
  programEmptyState.hidden = programs.length !== 0;
  programTableWrapper.hidden = programs.length === 0;

  for (const program of programs) {
    const row = document.createElement("tr");
    const nameCell = valueCell(program.name);
    nameCell.className = "name-cell";
    row.append(nameCell);

    const actions = document.createElement("td");
    actions.className = "actions";
    const deleteButton = document.createElement("button");
    deleteButton.className = "action-button action-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => removeProgram(program));
    actions.append(deleteButton);
    row.append(actions);
    programList.append(row);
  }
}

async function loadPrograms() {
  programLoading.hidden = false;
  programTableWrapper.hidden = true;
  programEmptyState.hidden = true;

  try {
    const response = await fetch("/programs");
    if (!response.ok) throw new Error("Não foi possível carregar os programas.");
    programs = (await response.json()).map(normalizeProgram);
    renderPrograms(programs);
    if (ambients.length > 0) renderAmbients(ambients);
  } catch (error) {
    programLoading.hidden = true;
    showFeedback(error.message);
  }
}

async function loadProcesses() {
  try {
    const response = await fetch("/processes");
    if (!response.ok) throw new Error("Não foi possível carregar os processos.");
    processes = (await response.json()).map(normalizeProcess);
    renderAmbients(ambients);
  } catch (error) {
    showFeedback(errorMessage(error, "Não foi possível carregar os processos."));
  }
}

async function createProcess(event) {
  event.preventDefault();
  createProcessButton.disabled = true;
  try {
    const params = new URLSearchParams(new FormData(processForm));
    const response = await fetch(`/processes?${params.toString()}`, { method: "POST" });
    if (!response.ok) throw new Error("Não foi possível criar o processo.");
    closeProcessDialog();
    await loadProcesses();
    showFeedback("Processo criado com sucesso.", "success");
  } catch (error) {
    showFeedback(errorMessage(error, "Não foi possível criar o processo."));
  } finally {
    createProcessButton.disabled = programs.length === 0;
  }
}

async function removeProcess(process) {
  const program = programs.find((item) => item.id === process.programId);
  if (!window.confirm(`Excluir o processo "${program ? program.name : process.programId}"?`)) return;
  try {
    const response = await fetch(`/processes/${process.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Não foi possível excluir o processo.");
    await loadProcesses();
    showFeedback("Processo excluído.", "success");
  } catch (error) {
    showFeedback(errorMessage(error, "Não foi possível excluir o processo."));
  }
}

function openProgramDialog() {
  programForm.reset();
  programDialog.showModal();
  programForm.elements.name.focus();
}

function closeProgramDialog() {
  programDialog.close();
  programForm.reset();
}

async function uploadProgram(event) {
  event.preventDefault();
  uploadButton.disabled = true;

  try {
    const response = await fetch("/programs", {
      method: "POST",
      body: new FormData(programForm),
    });

    if (!response.ok) {
      let message = "Não foi possível enviar o programa.";
      try {
        const details = await response.json();
        if (details.detail) message = errorMessage(details.detail, message);
      } catch {
        // Use the generic message when the server does not return JSON.
      }
      throw new Error(message);
    }

    closeProgramDialog();
    await loadPrograms();
    showFeedback("Programa enviado com sucesso.", "success");
  } catch (error) {
    showFeedback(error.message);
  } finally {
    uploadButton.disabled = false;
  }
}

async function removeProgram(program) {
  if (!window.confirm(`Excluir o programa "${program.name}"?`)) return;

  try {
    const response = await fetch(`/programs/${program.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Não foi possível excluir o programa.");
    await loadPrograms();
    showFeedback("Programa excluído.", "success");
  } catch (error) {
    showFeedback(error.message);
  }
}

document.querySelector("#new-ambient-button").addEventListener("click", openNewDialog);
document.querySelector("#refresh-button").addEventListener("click", loadInitialData);
document.querySelector("#cancel-button").addEventListener("click", closeDialog);
document.querySelector("#close-dialog-button").addEventListener("click", closeDialog);
form.addEventListener("submit", saveAmbient);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog();
});
document.querySelector("#new-program-button").addEventListener("click", openProgramDialog);
document.querySelector("#cancel-program-button").addEventListener("click", closeProgramDialog);
document.querySelector("#close-program-dialog-button").addEventListener("click", closeProgramDialog);
programForm.addEventListener("submit", uploadProgram);
programDialog.addEventListener("click", (event) => {
  if (event.target === programDialog) closeProgramDialog();
});
document.querySelector("#cancel-process-button").addEventListener("click", closeProcessDialog);
document.querySelector("#close-process-dialog-button").addEventListener("click", closeProcessDialog);
processForm.addEventListener("submit", createProcess);
processDialog.addEventListener("click", (event) => {
  if (event.target === processDialog) closeProcessDialog();
});

async function loadInitialData() {
  await loadAmbients();
  await loadPrograms();
  await loadProcesses();
}

setInterval(loadProcesses, 2000);
loadInitialData();