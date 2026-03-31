/**
 * 前端页面运行时状态。
 *
 * 这里集中保存初始化后拿到的下拉选项、全量记录、级联映射和查询历史，
 * 避免不同函数之间通过 DOM 反复读取同一份业务数据。
 */
const state = {
    queryMetadata: null,
    fieldMetaByKey: {},
    options: null,
    allRecords: [],
    cascadeData: {},
    searchLogs: [],
    aiConversation: [],
    lastAiResult: null
};

const API_BASE = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:8000/api'
    : '/api';

const measurementForm = document.getElementById('measurementForm');
const categorySelect = document.getElementById('category');
const subCategorySelect = document.getElementById('sub_category');
const equipmentNameSelect = document.getElementById('equipment_name');
const modelSelect = document.getElementById('model');
const manufacturerSelect = document.getElementById('manufacturer');
const measurementRequirementInput = document.getElementById('measurement_requirement');
const keywordInput = document.getElementById('keyword');
const messageBar = document.getElementById('messageBar');
const metadataBoard = document.getElementById('metadataBoard');
const syncDataBtn = document.getElementById('syncDataBtn');
const openHistoryBtn = document.getElementById('openHistoryBtn');
const openHistoryBtnResult = document.getElementById('openHistoryBtnResult');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const historyBackdrop = document.getElementById('historyBackdrop');
const historyModal = document.getElementById('historyModal');
const historyList = document.getElementById('historyList');
const aiSummaryCards = document.getElementById('aiSummaryCards');
const aiConversation = document.getElementById('aiConversation');
const aiPromptInput = document.getElementById('aiPromptInput');
const aiExtractBtn = document.getElementById('aiExtractBtn');
const aiSearchBtn = document.getElementById('aiSearchBtn');

measurementForm.addEventListener('submit', handleSubmit);
categorySelect.addEventListener('change', handleCategoryChange);
subCategorySelect.addEventListener('change', handleSubCategoryChange);
equipmentNameSelect.addEventListener('change', handleEquipmentChange);
modelSelect.addEventListener('change', handleModelChange);
syncDataBtn.addEventListener('click', handleSyncData);
openHistoryBtn.addEventListener('click', openHistoryModal);
openHistoryBtnResult.addEventListener('click', openHistoryModal);
closeHistoryBtn.addEventListener('click', closeHistoryModal);
historyBackdrop.addEventListener('click', closeHistoryModal);
aiExtractBtn.addEventListener('click', () => handleAiAssist(false));
aiSearchBtn.addEventListener('click', () => handleAiAssist(true));

window.addEventListener('DOMContentLoaded', initializePage);

/**
 * 初始化页面。
 *
 * 页面首次加载时并行请求：
 * 1. 全局筛选项。
 * 2. 默认搜索结果，用于前端构造级联关系和浏览模式的全量数据。
 * 3. 最近查询历史。
 *
 * 这一步相当于前端应用的“启动流程”。
 */
async function initializePage() {
    try {
        setMessage('正在加载筛选数据...', 'info');
        await loadPageData();

        if (state.allRecords.length === 0) {
            setMessage('当前本地数据为空，请先执行同步脚本。', 'info');
            return;
        }

        clearMessage();
    } catch (error) {
        setMessage(error.message || '加载初始数据失败，请确认后端服务已经启动。', 'error');
    }
}

async function loadPageData() {
    const [metadataResult, recordsResult, logsResult] = await Promise.all([
            fetchJson(buildApiUrl('/query-metadata')),
            fetchJson(buildApiUrl('/search'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: '',
                    sub_category: '',
                    equipment_name: '',
                    model: '',
                    manufacturer: '',
                    keyword: ''
                })
            }),
            fetchJson(buildApiUrl('/search-logs?limit=12'))
        ]);

    state.queryMetadata = metadataResult.data;
    state.fieldMetaByKey = buildFieldMetaMap(state.queryMetadata.fields || []);
    state.options = buildOptionsFromMetadata(state.queryMetadata);
    state.allRecords = transformRecords(recordsResult.data.records);
    state.cascadeData = generateCascadeData(state.allRecords);
    state.searchLogs = logsResult.data.records || [];
    renderMetadataBoard();
    syncFormMetadata();
    initializeAiWorkspace();
    renderHistoryList();

    populateSelect(categorySelect, state.options.categories, '请选择类别');
    resetSelect(subCategorySelect, '请先选择类别');
    resetSelect(equipmentNameSelect, '请先选择二级分类');
    resetSelect(modelSelect, '请先选择设备名称');
    resetSelect(manufacturerSelect, '请先选择型号');
}

function buildFieldMetaMap(fields) {
    return (fields || []).reduce((result, field) => {
        result[field.key] = field;
        return result;
    }, {});
}

function buildOptionsFromMetadata(metadata) {
    const fields = metadata && Array.isArray(metadata.fields) ? metadata.fields : [];
    const getOptions = key => {
        const field = fields.find(item => item.key === key);
        return field && Array.isArray(field.options) ? field.options : [];
    };

    return {
        categories: getOptions('category'),
        sub_categories: getOptions('sub_category'),
        equipment_names: getOptions('equipment_name'),
        models: getOptions('model'),
        manufacturers: getOptions('manufacturer')
    };
}

function getFieldMeta(key) {
    return state.fieldMetaByKey[key] || null;
}

function renderMetadataBoard() {
    const metadata = state.queryMetadata;
    if (!metadataBoard || !metadata) {
        return;
    }

    const groups = Array.isArray(metadata.groups) ? metadata.groups : [];
    metadataBoard.innerHTML = groups.map(group => {
        const fields = (group.fields || [])
            .map(fieldKey => getFieldMeta(fieldKey))
            .filter(Boolean)
            .map(field => `<span class="metadata-field">${escapeHtml(field.label)}</span>`)
            .join('');

        return `
            <article class="metadata-card">
                <h3>${escapeHtml(group.label || '')}</h3>
                <p>${escapeHtml(group.summary || '')}</p>
                <div class="metadata-field-list">${fields}</div>
            </article>
        `;
    }).join('');
}

function syncFormMetadata() {
    if (!state.queryMetadata) {
        return;
    }

    document.querySelectorAll('[data-field-label]').forEach(element => {
        const meta = getFieldMeta(element.dataset.fieldLabel);
        if (meta && meta.label) {
            element.textContent = meta.label;
        }
    });

    document.querySelectorAll('[data-field-hint]').forEach(element => {
        const meta = getFieldMeta(element.dataset.fieldHint);
        element.textContent = meta && meta.description ? meta.description : '';
    });

    [measurementRequirementInput, keywordInput].forEach(input => {
        const meta = getFieldMeta(input.name);
        if (meta && meta.placeholder) {
            input.placeholder = meta.placeholder;
        }
    });
}

function initializeAiWorkspace() {
    if (state.aiConversation.length === 0) {
        state.aiConversation.push({
            role: 'assistant',
            content: '可以直接描述器具类别、设备名称、测量范围、型号或厂家。我会抽取结构化条件并回填到左侧表单。',
            notes: ['支持“抽取并回填”后人工修正，也支持“抽取并搜索”直接进入结果页。'],
            followUpQuestions: [],
            filledFields: [],
            confidence: 'medium'
        });
    }

    renderAiSummaryCards();
    renderAiConversation();
}

function renderAiSummaryCards() {
    if (!aiSummaryCards) {
        return;
    }

    const metadataFieldCount = state.queryMetadata && Array.isArray(state.queryMetadata.fields)
        ? state.queryMetadata.fields.length
        : 0;

    if (!state.lastAiResult) {
        aiSummaryCards.innerHTML = `
            <div class="summary-card">
                <strong>抽取范围</strong>
                <p>当前 AI 会围绕 ${metadataFieldCount} 个查询字段抽取结构化参数，并与左侧表单保持同一套业务定义。</p>
            </div>
            <div class="summary-card">
                <strong>工作方式</strong>
                <p>先提取类别、设备、型号、厂家，再把无法稳定结构化的描述回退到关键字。</p>
            </div>
            <div class="summary-card">
                <strong>技术规则</strong>
                <p>一旦识别出测量对象要求范围，左侧搜索仍会沿用既有量程覆盖和 MPE 判定逻辑。</p>
            </div>
        `;
        return;
    }

    const filledChips = (state.lastAiResult.filled_fields || [])
        .map(field => `<span class="summary-chip">${escapeHtml(field.label)}: ${escapeHtml(field.value)}</span>`)
        .join('');
    const followUp = (state.lastAiResult.follow_up_questions || []).slice(0, 2).join('；') || '当前参数已可直接用于搜索。';

    aiSummaryCards.innerHTML = `
        <div class="summary-card">
            <strong>最近一次抽取</strong>
            <p>${escapeHtml(state.lastAiResult.assistant_reply || '')}</p>
        </div>
        <div class="summary-card">
            <strong>已回填字段</strong>
            <div class="summary-chip-list">${filledChips || '<span class="summary-chip">暂无</span>'}</div>
        </div>
        <div class="summary-card">
            <strong>下一步建议</strong>
            <p>${escapeHtml(followUp)}</p>
        </div>
    `;
}

function renderAiConversation() {
    if (!aiConversation) {
        return;
    }

    aiConversation.innerHTML = state.aiConversation.map(entry => {
        if (entry.role === 'user') {
            return `
                <div class="ai-message user">
                    <div class="ai-message-title">工作人员</div>
                    <div>${escapeHtml(entry.content)}</div>
                </div>
            `;
        }

        const filledFields = (entry.filledFields || []).map(field => `${field.label}: ${field.value}`);
        const notes = (entry.notes || []).map(item => `<div>${escapeHtml(item)}</div>`).join('');
        const followUps = (entry.followUpQuestions || []).map(item => `<div>${escapeHtml(item)}</div>`).join('');

        return `
            <div class="ai-message assistant">
                <div class="ai-message-title">AI 助手${entry.confidence ? ` · ${escapeHtml(formatConfidence(entry.confidence))}` : ''}</div>
                <div>${escapeHtml(entry.content || '')}</div>
                ${filledFields.length > 0 ? `
                    <div class="assistant-section">
                        <strong>本次抽取</strong>
                        <div class="summary-chip-list">${filledFields.map(item => `<span class="summary-chip">${escapeHtml(item)}</span>`).join('')}</div>
                    </div>
                ` : ''}
                ${notes ? `
                    <div class="assistant-section">
                        <strong>说明</strong>
                        <div class="assistant-list">${notes}</div>
                    </div>
                ` : ''}
                ${followUps ? `
                    <div class="assistant-section">
                        <strong>建议补充</strong>
                        <div class="assistant-list">${followUps}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    aiConversation.scrollTop = aiConversation.scrollHeight;
}

function formatConfidence(confidence) {
    if (confidence === 'high') {
        return '高置信';
    }
    if (confidence === 'low') {
        return '低置信';
    }
    return '中置信';
}

async function handleAiAssist(searchAfterExtract) {
    const message = aiPromptInput.value.trim();
    if (!message) {
        setMessage('请先在右侧输入自然语言选型需求。', 'error');
        aiPromptInput.focus();
        return;
    }

    state.aiConversation.push({ role: 'user', content: message });
    renderAiConversation();
    setAiBusy(true, searchAfterExtract ? '正在抽取并准备搜索...' : '正在抽取参数...');

    try {
        const response = await fetchJson(buildApiUrl('/ai/extract'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                current_query: getCurrentQueryPayload()
            })
        });

        state.lastAiResult = response.data;
        populateFormFromQuery(response.data.query || {});
        state.aiConversation.push({
            role: 'assistant',
            content: response.data.assistant_reply || '已完成参数抽取并回填。',
            filledFields: response.data.filled_fields || [],
            notes: response.data.notes || [],
            followUpQuestions: response.data.follow_up_questions || [],
            confidence: response.data.confidence || 'medium'
        });
        aiPromptInput.value = '';
        renderAiSummaryCards();
        renderAiConversation();
        setMessage(searchAfterExtract ? 'AI 已完成参数抽取，正在执行搜索。' : 'AI 已完成参数抽取并回填到左侧表单。', 'success');

        if (searchAfterExtract) {
            measurementForm.requestSubmit();
        }
    } catch (error) {
        state.aiConversation.push({
            role: 'assistant',
            content: error.message || 'AI 参数抽取失败。',
            notes: ['左侧传统搜索仍然可用。若要启用 AI，请确认后端已配置 Qwen 接口。'],
            followUpQuestions: [],
            filledFields: [],
            confidence: 'low'
        });
        renderAiConversation();
        setMessage(error.message || 'AI 参数抽取失败。', 'error');
    } finally {
        setAiBusy(false);
    }
}

function setAiBusy(isBusy, busyMessage = '') {
    aiExtractBtn.disabled = isBusy;
    aiSearchBtn.disabled = isBusy;
    if (isBusy) {
        setMessage(busyMessage, 'info');
    }
}

function getCurrentQueryPayload() {
    return {
        category: categorySelect.value,
        sub_category: subCategorySelect.value,
        equipment_name: equipmentNameSelect.value,
        model: modelSelect.value,
        manufacturer: manufacturerSelect.value,
        keyword: keywordInput.value.trim(),
        measurement_requirement: measurementRequirementInput.value.trim()
    };
}

async function handleSyncData() {
    syncDataBtn.disabled = true;
    const originalText = syncDataBtn.textContent;
    syncDataBtn.textContent = '更新中...';

    try {
        setMessage('正在同步钉钉数据，请稍候...', 'info');
        const response = await fetchJson(buildApiUrl('/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        await loadPageData();
        setMessage(`数据更新成功，当前共 ${response.data.total} 条记录。`, 'success');
    } catch (error) {
        setMessage(error.message || '数据更新失败，请稍后重试。', 'error');
    } finally {
        syncDataBtn.disabled = false;
        syncDataBtn.textContent = originalText;
    }
}

/**
 * 把平铺记录整理成级联下拉所需的嵌套结构。
 *
 * 结构形态为：类别 -> 二级分类 -> 设备名称 -> 型号 -> 厂家列表。
 * 这样在任一级下拉变化时，后续下拉都可以直接从内存中推导，不需要再次请求后端。
 */
function generateCascadeData(data) {
    const result = {};
    data.forEach(record => {
        const category = record.fields.一级分类.name;
        const subCategory = record.fields.二级分类;
        const equipmentName = record.fields.名称;
        const model = record.fields.型号;
        const manufacturer = record.fields.生产厂家;

        if (!result[category]) {
            result[category] = {};
        }
        if (!result[category][subCategory]) {
            result[category][subCategory] = {};
        }
        if (!result[category][subCategory][equipmentName]) {
            result[category][subCategory][equipmentName] = {};
        }
        if (!result[category][subCategory][equipmentName][model]) {
            result[category][subCategory][equipmentName][model] = [];
        }
        if (!result[category][subCategory][equipmentName][model].includes(manufacturer)) {
            result[category][subCategory][equipmentName][model].push(manufacturer);
        }
    });
    return result;
}

/**
 * 处理“类别”下拉变化。
 *
 * 当上游条件变化时，下游所有选择都必须清空，否则会出现旧值与新路径不匹配的问题。
 */
function handleCategoryChange() {
    const selectedCategory = categorySelect.value;
    resetSelect(subCategorySelect, '请选择二级分类');
    resetSelect(equipmentNameSelect, '请先选择二级分类');
    resetSelect(modelSelect, '请先选择设备名称');
    resetSelect(manufacturerSelect, '请先选择型号');

    if (!selectedCategory || !state.cascadeData[selectedCategory]) {
        return;
    }

    populateSelect(
        subCategorySelect,
        Object.keys(state.cascadeData[selectedCategory]),
        '请选择二级分类'
    );
}

/**
 * 处理“二级分类”变化，并刷新设备名称列表。
 */
function handleSubCategoryChange() {
    const selectedCategory = categorySelect.value;
    const selectedSubCategory = subCategorySelect.value;
    resetSelect(equipmentNameSelect, '请选择设备名称');
    resetSelect(modelSelect, '请先选择设备名称');
    resetSelect(manufacturerSelect, '请先选择型号');

    if (!selectedCategory || !selectedSubCategory) {
        return;
    }

    const equipmentNames = Object.keys(state.cascadeData[selectedCategory][selectedSubCategory] || {});
    populateSelect(equipmentNameSelect, equipmentNames, '请选择设备名称');
}

/**
 * 处理“设备名称”变化，并刷新型号列表。
 */
function handleEquipmentChange() {
    const selectedCategory = categorySelect.value;
    const selectedSubCategory = subCategorySelect.value;
    const selectedEquipment = equipmentNameSelect.value;
    resetSelect(modelSelect, '请选择型号');
    resetSelect(manufacturerSelect, '请先选择型号');

    if (!selectedCategory || !selectedSubCategory || !selectedEquipment) {
        return;
    }

    const models = Object.keys(state.cascadeData[selectedCategory][selectedSubCategory][selectedEquipment] || {});
    populateSelect(modelSelect, models, '请选择型号');
}

/**
 * 处理“型号”变化，并刷新厂家列表。
 *
 * 当前数据里厂家位于级联结构的最后一层，因此型号确定后即可得出候选厂家。
 */
function handleModelChange() {
    const selectedCategory = categorySelect.value;
    const selectedSubCategory = subCategorySelect.value;
    const selectedEquipment = equipmentNameSelect.value;
    const selectedModel = modelSelect.value;
    resetSelect(manufacturerSelect, '请选择厂家');

    if (!selectedCategory || !selectedSubCategory || !selectedEquipment || !selectedModel) {
        return;
    }

    const manufacturers = state.cascadeData[selectedCategory][selectedSubCategory][selectedEquipment][selectedModel] || [];
    populateSelect(manufacturerSelect, manufacturers, '请选择厂家');
}

/**
 * 处理表单提交。
 *
 * 这个函数串起了整条前端业务流程：
 * 1. 解析测量对象要求范围。
 * 2. 调用 FastAPI 搜索接口获取基础候选记录。
 * 3. 刷新查询历史。
 * 4. 如填写了测量范围，则执行量程覆盖和 MPE 技术筛选。
 * 5. 对结果排序并渲染页面。
 */
async function handleSubmit(event) {
    event.preventDefault();

    const requirementText = measurementRequirementInput.value.trim();
    const measurementRequirement = requirementText ? parseMeasurementRequirement(requirementText) : null;
    if (requirementText && !measurementRequirement) {
        setMessage('测量对象要求范围格式无效，请输入类似 (5.4-5.7)mm、（10~12）mm 或 10±1mm 的格式。', 'error');
        measurementRequirementInput.focus();
        return;
    }

    const formData = {
        category: categorySelect.value,
        sub_category: subCategorySelect.value,
        equipment_name: equipmentNameSelect.value,
        model: modelSelect.value,
        manufacturer: manufacturerSelect.value,
        keyword: keywordInput.value.trim(),
        measurement_requirement: requirementText,
        measurement_requirement_parsed: measurementRequirement
    };

    try {
        setMessage('正在查询数据...', 'info');
        const response = await fetchJson(buildApiUrl('/search'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: formData.category,
                sub_category: formData.sub_category,
                equipment_name: formData.equipment_name,
                model: formData.model,
                manufacturer: formData.manufacturer,
                keyword: formData.keyword,
                measurement_requirement: formData.measurement_requirement
            })
        });

        const candidateRecords = transformRecords(response.data.records);
        await refreshSearchLogs();
        const selectedRecords = measurementRequirement
            ? filterRecordsByMeasurement(candidateRecords, measurementRequirement)
            : candidateRecords.map(record => ({
                ...record,
                computedMpe: null,
                computedRange: getDeviceRange(record, '')
            }));

        const mergedRecords = mergeRecordsByEquipmentAndModel(selectedRecords).sort((left, right) => {
            if (!measurementRequirement) {
                return sortRecordsForBrowse(left, right);
            }

            const leftMpe = left.computedMpe ? left.computedMpe.normalizedValue : null;
            const rightMpe = right.computedMpe ? right.computedMpe.normalizedValue : null;

            if (leftMpe === null && rightMpe === null) {
                return 0;
            }
            if (leftMpe === null) {
                return 1;
            }
            if (rightMpe === null) {
                return -1;
            }

            return rightMpe - leftMpe;
        });

        clearMessage();
        displayResults(formData, mergedRecords);
    } catch (error) {
        setMessage(error.message || '查询失败，请稍后重试。', 'error');
    }
}

/**
 * 按测量对象要求范围做技术筛选。
 *
 * 只有同时满足以下条件的设备才会保留：
 * 1. 设备量程完整覆盖要求区间。
 * 2. 根据设备规则计算出的 MPE 不超过“区间长度 ÷ 6”的上限。
 */
function filterRecordsByMeasurement(candidateRecords, measurementRequirement) {
    const selectedRecords = [];

    candidateRecords.forEach(record => {
        const deviceRange = getDeviceRange(record, measurementRequirement.unit);
        const deviceRangeMin = deviceRange.minBase;
        const deviceRangeMax = deviceRange.maxBase;
        if (
            deviceRangeMin === null ||
            deviceRangeMax === null ||
            measurementRequirement.minBase < deviceRangeMin ||
            measurementRequirement.maxBase > deviceRangeMax
        ) {
            return;
        }

        const computedMpe = calculateDeviceMpe(record, measurementRequirement, deviceRange);
        if (!computedMpe || computedMpe.normalizedValue === null || computedMpe.normalizedValue > measurementRequirement.mpeLimitBase) {
            return;
        }

        selectedRecords.push({
            ...record,
            computedMpe,
            computedRange: deviceRange
        });
    });

    return selectedRecords;
}

/**
 * 重新加载最近查询历史并刷新弹窗内容。
 *
 * 查询完成后再次请求日志接口，确保“刚刚执行过的搜索”能立即出现在历史记录里。
 */
async function refreshSearchLogs() {
    const logsResult = await fetchJson(buildApiUrl('/search-logs?limit=12'));
    state.searchLogs = logsResult.data.records || [];
    renderHistoryList();
}

/**
 * 浏览模式下的结果排序规则。
 *
 * 没有启用技术筛选时，按类别、二级分类、名称、型号做稳定排序，方便人工浏览。
 */
function sortRecordsForBrowse(left, right) {
    const leftText = `${left.fields.一级分类.name}|${left.fields.二级分类}|${left.fields.名称}|${left.fields.型号}`;
    const rightText = `${right.fields.一级分类.name}|${right.fields.二级分类}|${right.fields.名称}|${right.fields.型号}`;
    return leftText.localeCompare(rightText, 'zh-CN');
}

/**
 * 拼接 API 地址。
 *
 * 页面以本地文件方式打开时使用固定本地后端地址，部署到 FastAPI 静态托管后则走相对路径。
 */
function buildApiUrl(path) {
    return `${API_BASE}${path}`;
}

/**
 * 统一执行 fetch 并解析标准 JSON 响应。
 *
 * 后端约定返回 success/message/data 结构，因此这里集中处理网络错误、HTTP 错误和业务错误，
 * 避免每个调用点都写一遍重复判断。
 */
async function fetchJson(url, options) {
    let response;
    try {
        response = await fetch(url, options);
    } catch (error) {
        throw new Error('无法连接后端接口，请先启动 FastAPI 服务。');
    }

    const payload = await response.json();
    if (!response.ok || !payload.success) {
        throw new Error(payload.message || '请求失败');
    }
    return payload;
}

/**
 * 在页面顶部展示状态消息。
 *
 * type 会映射到不同样式，用来区分提示、成功和错误状态。
 */
function setMessage(message, type) {
    messageBar.textContent = message;
    messageBar.className = `message-bar ${type}`;
}

/**
 * 打开查询历史弹窗。
 */
function openHistoryModal() {
    renderHistoryList();
    historyModal.classList.remove('hidden');
}

/**
 * 关闭查询历史弹窗。
 */
function closeHistoryModal() {
    historyModal.classList.add('hidden');
}

/**
 * 把查询历史渲染到弹窗中。
 *
 * 每条历史记录都会显示查询时间、命中数量和条件摘要，并提供“一键回填”按钮。
 */
function renderHistoryList() {
    const logs = state.searchLogs || [];
    if (logs.length === 0) {
        historyList.innerHTML = '<p class="history-empty">暂无查询历史。</p>';
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'history-list';

    logs.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const queryLines = buildHistoryQueryLines(entry.query || {});
        item.innerHTML = `
            <div class="history-item-top">
                <div class="history-time">${escapeHtml(formatHistoryTime(entry.searched_at || ''))}</div>
                <div class="history-result-total">结果 ${escapeHtml(String(entry.result_total ?? 0))} 条</div>
            </div>
            <div class="history-query-lines">${queryLines}</div>
            <div class="history-actions">
                <button type="button" class="history-apply-btn" data-index="${index}">使用这组条件</button>
            </div>
        `;
        wrapper.appendChild(item);
    });

    historyList.innerHTML = '';
    historyList.appendChild(wrapper);
    historyList.querySelectorAll('.history-apply-btn').forEach(button => {
        button.addEventListener('click', () => applyHistoryEntry(Number(button.dataset.index)));
    });
}

/**
 * 把一次查询条件转换成适合展示的 HTML 片段。
 *
 * 这里只展示用户真正填写过的条件，避免空字段占满界面。
 */
function buildHistoryQueryLines(query) {
    const lines = [
        ['类别', query.category],
        ['二级分类', query.sub_category],
        ['设备名称', query.equipment_name],
        ['型号', query.model],
        ['厂家', query.manufacturer],
        ['关键字', query.keyword],
        ['测量对象要求范围', query.measurement_requirement]
    ]
        .filter(([, value]) => value)
        .map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</div>`);

    if (lines.length === 0) {
        return '<div><strong>条件:</strong> 未填写任何条件</div>';
    }

    return lines.join('');
}

/**
 * 应用某条历史查询条件。
 *
 * 用户点击“使用这组条件”后，表单会被回填到当时的查询状态，但不会自动触发查询，
 * 这样用户仍然可以微调条件后再提交。
 */
function applyHistoryEntry(index) {
    const entry = state.searchLogs[index];
    if (!entry || !entry.query) {
        return;
    }

    const query = entry.query;
    populateFormFromQuery(query);
    closeHistoryModal();
    setMessage('已回填历史查询条件，可直接提交重新查询。', 'success');
}

/**
 * 按历史记录中的查询参数回填整个表单。
 *
 * 回填顺序必须遵循级联关系，从类别开始逐层触发 change 逻辑，否则后续下拉框还没准备好。
 */
function populateFormFromQuery(query) {
    categorySelect.value = query.category || '';
    handleCategoryChange();

    subCategorySelect.value = query.sub_category || '';
    handleSubCategoryChange();

    equipmentNameSelect.value = query.equipment_name || '';
    handleEquipmentChange();

    modelSelect.value = query.model || '';
    handleModelChange();

    manufacturerSelect.value = query.manufacturer || '';
    keywordInput.value = query.keyword || '';
    measurementRequirementInput.value = query.measurement_requirement || '';
}

/**
 * 把日志中的 ISO 时间格式化为中文本地时间字符串。
 */
function formatHistoryTime(value) {
    if (!value) {
        return '未知时间';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 对文本做最基本的 HTML 转义。
 *
 * 历史记录和结果卡片中有一部分内容通过 innerHTML 渲染，因此需要手动转义，
 * 避免用户输入的关键字或日志字段破坏页面结构。
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 清空顶部消息栏并隐藏。
 */
function clearMessage() {
    messageBar.textContent = '';
    messageBar.className = 'message-bar hidden';
}

/**
 * 把一组选项填充到指定下拉框。
 *
 * 每次填充前都会先重置为占位项，避免旧选项残留。
 */
function populateSelect(selectElement, items, placeholder) {
    resetSelect(selectElement, placeholder);
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        selectElement.appendChild(option);
    });
}

/**
 * 重置下拉框，只保留一个占位选项。
 */
function resetSelect(selectElement, placeholder) {
    selectElement.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    selectElement.appendChild(option);
}

/**
 * 把后端返回的数据结构转换成前端现有渲染逻辑所需的字段形态。
 *
 * 前端沿用了更接近原始表结构的 fields 形式，因此这里承担一次适配层作用。
 */
function transformRecords(records) {
    return (records || []).map(record => ({
        record_id: record.record_id || '',
        fields: {
            一级分类: { name: record.一级分类 || '' },
            二级分类: record.二级分类 || '',
            名称: record.名称 || '',
            型号: record.型号 || '',
            生产厂家: record.生产厂家 || '',
            测量下限: record.测量下限 || '',
            测量上限: record.测量上限 || '',
            准确度: record.准确度 || '',
            MPE: record.最大允许误差 || record.准确度 || '',
            分度值: record.分度值 || '',
            应用场景: record.应用场景 || '',
            图片: toImageArray(record.图片),
            原始字段: record.原始字段 || {}
        }
    }));
}

/**
 * 把图片字段统一转换为数组形式。
 *
 * 这样渲染层可以始终按“附件列表”的方式读取，而不用关心后端传来的是空值、字符串还是数组。
 */
function toImageArray(imageValue) {
    if (!imageValue) {
        return [];
    }
    if (Array.isArray(imageValue)) {
        return imageValue;
    }
    if (typeof imageValue === 'string' && imageValue.startsWith('http')) {
        return [{ url: imageValue }];
    }
    return [];
}

const UNIT_MAP = {
    '': { factor: 1, dimension: 'generic', display: '' },
    'mm': { factor: 1e-3, dimension: 'length', display: 'mm' },
    'cm': { factor: 1e-2, dimension: 'length', display: 'cm' },
    'm': { factor: 1, dimension: 'length', display: 'm' },
    'um': { factor: 1e-6, dimension: 'length', display: 'um' },
    'μm': { factor: 1e-6, dimension: 'length', display: 'μm' },
    'mg': { factor: 1e-6, dimension: 'mass', display: 'mg' },
    'g': { factor: 1e-3, dimension: 'mass', display: 'g' },
    'kg': { factor: 1, dimension: 'mass', display: 'kg' },
    'ml': { factor: 1e-3, dimension: 'volume', display: 'mL' },
    'l': { factor: 1, dimension: 'volume', display: 'L' },
    '℃': { factor: 1, dimension: 'temperature', display: '℃' },
    '°c': { factor: 1, dimension: 'temperature', display: '℃' },
    'c': { factor: 1, dimension: 'temperature', display: '℃' },
    'v': { factor: 1, dimension: 'voltage', display: 'V' },
    'mv': { factor: 1e-3, dimension: 'voltage', display: 'mV' },
    'kv': { factor: 1e3, dimension: 'voltage', display: 'kV' },
    'a': { factor: 1, dimension: 'current', display: 'A' },
    'ma': { factor: 1e-3, dimension: 'current', display: 'mA' },
    'ua': { factor: 1e-6, dimension: 'current', display: 'uA' },
    'μa': { factor: 1e-6, dimension: 'current', display: 'μA' },
    'ω': { factor: 1, dimension: 'resistance', display: 'Ω' },
    'kω': { factor: 1e3, dimension: 'resistance', display: 'kΩ' },
    'mω': { factor: 1e6, dimension: 'resistance', display: 'MΩ' },
    '%': { factor: 1, dimension: 'generic', display: '%' }
};

/**
 * 解析用户输入的测量对象要求范围。
 *
 * 输入示例：(5.4-5.7)mm、（10~12）mm、10±1mm。
 * 无论用户输入区间还是“中心值±偏差”，最终都会转换成同一套区间结构，
 * 供后续量程覆盖和 MPE 判定逻辑复用。
 */
function parseMeasurementRequirement(input) {
    if (!input) {
        return null;
    }

    const normalized = input
        .replace(/（/g, '(')
        .replace(/）/g, ')')
        .replace(/～/g, '~')
        .replace(/—/g, '-')
        .replace(/–/g, '-')
        .replace(/\s+/g, '')
        .toLowerCase();

    const intervalMatch = normalized.match(/\(?(-?\d+(?:\.\d+)?)\s*[-~]\s*(-?\d+(?:\.\d+)?)\)?([a-z%μμΩ℃°\u4e00-\u9fa5]*)?/i);
    if (intervalMatch) {
        const firstValue = Number(intervalMatch[1]);
        const secondValue = Number(intervalMatch[2]);
        if (!Number.isFinite(firstValue) || !Number.isFinite(secondValue) || secondValue <= firstValue) {
            return null;
        }

        return buildMeasurementRequirement({
            min: firstValue,
            max: secondValue,
            rawUnit: (intervalMatch[3] || '').trim(),
            originalInput: input,
            format: 'interval'
        });
    }

    const plusMinusMatch = normalized.match(/\(?(-?\d+(?:\.\d+)?)\s*±\s*(\d+(?:\.\d+)?)\)?([a-z%μμΩ℃°\u4e00-\u9fa5]*)?/i);
    if (!plusMinusMatch) {
        return null;
    }

    const midpoint = Number(plusMinusMatch[1]);
    const tolerance = Number(plusMinusMatch[2]);
    if (!Number.isFinite(midpoint) || !Number.isFinite(tolerance) || tolerance <= 0) {
        return null;
    }

    return buildMeasurementRequirement({
        min: midpoint - tolerance,
        max: midpoint + tolerance,
        rawUnit: (plusMinusMatch[3] || '').trim(),
        originalInput: input,
        format: 'plus-minus',
        midpoint,
        tolerance
    });
}

function buildMeasurementRequirement({ min, max, rawUnit, originalInput, format, midpoint = null, tolerance = null }) {
    const unit = normalizeDisplayUnit(rawUnit || inferUnitFromRange(originalInput));
    const unitMeta = getUnitMeta(unit);
    const intervalLength = max - min;
    const resolvedMidpoint = midpoint === null ? (min + max) / 2 : midpoint;
    const minBase = toBaseUnit(min, unit);
    const maxBase = toBaseUnit(max, unit);
    const intervalLengthBase = maxBase - minBase;

    return {
        min,
        max,
        unit,
        dimension: unitMeta.dimension,
        intervalLength,
        midpoint: resolvedMidpoint,
        absMidpoint: Math.abs(resolvedMidpoint),
        minBase,
        maxBase,
        midpointBase: toBaseUnit(resolvedMidpoint, unit),
        absMidpointBase: Math.abs(toBaseUnit(resolvedMidpoint, unit)),
        intervalLengthBase,
        mpeLimit: intervalLength / 6,
        mpeLimitBase: intervalLengthBase / 6,
        inputFormat: format,
        inputText: String(originalInput || '').trim(),
        tolerance
    };
}

/**
 * 当正则没有稳定识别到区间后的单位时，尝试从原始输入尾部补推单位。
 */
function inferUnitFromRange(input) {
    const unitMatch = input.match(/[a-zA-Z%μμΩ℃°\u4e00-\u9fa5]+\s*$/);
    return unitMatch ? unitMatch[0].trim() : '';
}

/**
 * 统一不同写法的单位表示。
 *
 * 比如把 mv、MV、mV 统一成 mV，把 ohm/ω 等统一成 Ω，便于后续做单位换算。
 */
function normalizeDisplayUnit(unit) {
    if (!unit) {
        return '';
    }

    const normalized = String(unit)
        .replace(/\s+/g, '')
        .replace(/µ/g, 'μ')
        .replace(/ohm/ig, 'Ω')
        .replace(/ω/g, 'Ω');

    if (/^mv$/i.test(normalized)) {
        return 'mV';
    }
    if (/^kv$/i.test(normalized)) {
        return 'kV';
    }
    if (/^v$/i.test(normalized)) {
        return 'V';
    }
    if (/^ma$/i.test(normalized)) {
        return 'mA';
    }
    if (/^ua$/i.test(normalized) || /^μa$/i.test(normalized)) {
        return 'μA';
    }
    if (/^a$/i.test(normalized)) {
        return 'A';
    }
    if (/^mω$/i.test(normalized) && normalized.includes('Ω')) {
        return 'MΩ';
    }
    if (/^kω$/i.test(normalized)) {
        return 'kΩ';
    }
    if (/^ω$/i.test(normalized)) {
        return 'Ω';
    }
    if (/^ml$/i.test(normalized)) {
        return 'mL';
    }
    if (/^l$/i.test(normalized)) {
        return 'L';
    }
    if (/^(°c|℃|c)$/i.test(normalized)) {
        return '℃';
    }
    if (/^um$/i.test(normalized) || /^μm$/i.test(normalized)) {
        return 'μm';
    }
    if (/^mm$/i.test(normalized)) {
        return 'mm';
    }
    if (/^cm$/i.test(normalized)) {
        return 'cm';
    }
    if (/^m$/i.test(normalized)) {
        return 'm';
    }
    if (/^mg$/i.test(normalized)) {
        return 'mg';
    }
    if (/^kg$/i.test(normalized)) {
        return 'kg';
    }
    if (/^g$/i.test(normalized)) {
        return 'g';
    }

    return normalized;
}

/**
 * 把显示单位转换为 UNIT_MAP 使用的查找键。
 */
function getUnitKey(unit) {
    if (!unit) {
        return '';
    }
    return normalizeDisplayUnit(unit).toLowerCase();
}

/**
 * 获取某个单位对应的换算信息和量纲信息。
 */
function getUnitMeta(unit) {
    return UNIT_MAP[getUnitKey(unit)] || { factor: 1, dimension: 'generic', display: normalizeDisplayUnit(unit) };
}

/**
 * 把某个单位下的数值换算到基准单位。
 *
 * 例如 mm 会换算到 m，g 会换算到 kg。这样不同单位的值才能直接比较。
 */
function toBaseUnit(value, unit) {
    if (!Number.isFinite(value)) {
        return null;
    }
    const meta = getUnitMeta(unit);
    return value * meta.factor;
}

/**
 * 把基准单位数值还原到指定显示单位。
 */
function fromBaseUnit(value, unit) {
    if (!Number.isFinite(value)) {
        return null;
    }
    const meta = getUnitMeta(unit);
    return meta.factor === 0 ? null : value / meta.factor;
}

/**
 * 从设备字段里解析“数值 + 单位”。
 *
 * 设备数据中的测量上下限和误差公式不一定格式完全一致，这个函数负责把它们统一拆成
 * 数值、单位、标准化数值和量纲，供后续计算复用。
 */
function parseValueWithUnit(value, fallbackUnit) {
    if (value === undefined || value === null || value === '') {
        return { value: null, unit: normalizeDisplayUnit(fallbackUnit || ''), normalizedValue: null, dimension: getUnitMeta(fallbackUnit || '').dimension };
    }

    if (typeof value === 'number') {
        const resolvedUnit = normalizeDisplayUnit(fallbackUnit || '');
        return {
            value,
            unit: resolvedUnit,
            normalizedValue: toBaseUnit(value, resolvedUnit),
            dimension: getUnitMeta(resolvedUnit).dimension
        };
    }

    const text = String(value).trim();
    const match = text.match(/(-?\d+(?:\.\d+)?)(?:\s*)([a-zA-ZμμΩ℃°]+)?/);
    if (!match) {
        const resolvedUnit = normalizeDisplayUnit(fallbackUnit || '');
        return { value: null, unit: resolvedUnit, normalizedValue: null, dimension: getUnitMeta(resolvedUnit).dimension };
    }

    const parsedValue = Number(match[1]);
    const parsedUnit = normalizeDisplayUnit(match[2] || fallbackUnit || '');
    return {
        value: Number.isFinite(parsedValue) ? parsedValue : null,
        unit: parsedUnit,
        normalizedValue: Number.isFinite(parsedValue) ? toBaseUnit(parsedValue, parsedUnit) : null,
        dimension: getUnitMeta(parsedUnit).dimension
    };
}

/**
 * 读取设备的测量上下限并换算成统一结构。
 */
function getDeviceRange(record, fallbackUnit) {
    const minInfo = parseValueWithUnit(record.fields.测量下限, fallbackUnit);
    const maxInfo = parseValueWithUnit(record.fields.测量上限, fallbackUnit);

    return {
        min: minInfo.value,
        max: maxInfo.value,
        unit: maxInfo.unit || minInfo.unit || normalizeDisplayUnit(fallbackUnit || ''),
        minBase: minInfo.normalizedValue,
        maxBase: maxInfo.normalizedValue
    };
}

/**
 * 归一化 MPE 公式文本。
 *
 * 数据源中的符号可能混用全角、半角和不同乘号写法，先做清洗能显著降低后续公式匹配复杂度。
 */
function normalizeFormulaText(value) {
    return String(value || '')
        .replace(/（/g, '(')
        .replace(/）/g, ')')
        .replace(/％/g, '%')
        .replace(/×/g, '*')
        .replace(/X/g, '*')
        .replace(/示值/g, '示值')
        .replace(/满量程/g, '满量程')
        .replace(/最大量程/g, '最大量程')
        .replace(/\s+/g, '');
}

/**
 * 从文本中提取百分比数值。
 */
function extractPercent(text) {
    const match = text.match(/(-?\d+(?:\.\d+)?)%/);
    return match ? Number(match[1]) : null;
}

/**
 * 统一构造 MPE 计算结果对象。
 *
 * 不同公式解析函数都会返回这类结构，便于筛选逻辑和渲染逻辑使用同一套字段。
 */
function buildCalculatedMpeResult(value, displayUnit, expression, requirement) {
    if (!Number.isFinite(value)) {
        return null;
    }

    const resolvedUnit = normalizeDisplayUnit(displayUnit || requirement.unit || '');
    const normalizedValue = toBaseUnit(value, resolvedUnit);
    return {
        value,
        unit: resolvedUnit,
        normalizedValue,  // 用来比较的基准数值（0.03mm 会转换成 0.00003m）
        displayValue: `${formatNumber(value)}${resolvedUnit ? ' ' + resolvedUnit : ''}`,  // 用来显示的字符串（保持原单位，格式化数值）
        expression
    };
}

/**
 * 解析“百分比示值 + 固定常数”类公式。
 *
 * 例如：0.05%示值+0.01mm。
 */
function calculateByReadingPlusConstant(formula, requirement) {
    const match = formula.match(/(-?\d+(?:\.\d+)?)%示值\+(-?\d+(?:\.\d+)?)([a-zA-ZμμΩ℃°]+)/i);
    if (!match) {
        return null;
    }

    const readingPercent = Number(match[1]);
    const constantValue = Number(match[2]);
    const constantUnit = normalizeDisplayUnit(match[3]);
    const displayUnit = requirement.unit || constantUnit;
    const readingInDisplayUnit = fromBaseUnit(requirement.midpointBase, displayUnit);
    const constantInDisplayUnit = fromBaseUnit(toBaseUnit(constantValue, constantUnit), displayUnit);
    if (!Number.isFinite(readingInDisplayUnit) || !Number.isFinite(constantInDisplayUnit)) {
        return null;
    }

    const result = Math.abs(readingInDisplayUnit) * readingPercent / 100 + Math.abs(constantInDisplayUnit);
    return buildCalculatedMpeResult(
        result,
        displayUnit,
        `±(${formatNumber(Math.abs(readingInDisplayUnit))} × ${formatNumber(readingPercent)}% + ${formatNumber(Math.abs(constantInDisplayUnit))}) = ${formatNumber(result)} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, displayUnit))}`,
        requirement
    );
}

/**
 * 解析“百分比示值 + 百分比满量程”类公式。
 *
 * 例如：0.02%示值+0.01%FS。
 */
function calculateByReadingPlusFullScalePercent(formula, requirement, deviceRange) {
    const match = formula.match(/(-?\d+(?:\.\d+)?)%示值\+(-?\d+(?:\.\d+)?)%(?:最大量程|满量程|FS)/i);
    if (!match) {
        return null;
    }

    const readingPercent = Number(match[1]);
    const fullScalePercent = Number(match[2]);
    const displayUnit = requirement.unit || deviceRange.unit;
    const readingInDisplayUnit = fromBaseUnit(requirement.midpointBase, displayUnit);
    const fullScaleInDisplayUnit = fromBaseUnit(deviceRange.maxBase, displayUnit);
    if (!Number.isFinite(readingInDisplayUnit) || !Number.isFinite(fullScaleInDisplayUnit)) {
        return null;
    }

    const result = Math.abs(readingInDisplayUnit) * readingPercent / 100 + Math.abs(fullScaleInDisplayUnit) * fullScalePercent / 100;
    return buildCalculatedMpeResult(
        result,
        displayUnit,
        `±(${formatNumber(Math.abs(readingInDisplayUnit))} × ${formatNumber(readingPercent)}% + ${formatNumber(Math.abs(fullScaleInDisplayUnit))} × ${formatNumber(fullScalePercent)}%) = ${formatNumber(result)} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, displayUnit))}`,
        requirement
    );
}

/**
 * 解析“仅按示值百分比计算”的公式。
 *
 * 支持两种常见写法：带“示值”字样的公式，以及直接写成 ±0.1% 这样的简写。
 */
function calculateByPercentOfReading(formula, requirement) {
    if (/示值/.test(formula)) {
        const match = formula.match(/(-?\d+(?:\.\d+)?)%示值/i);
        if (!match) {
            return null;
        }

        const percent = Number(match[1]);
        const displayUnit = requirement.unit;
        const readingInDisplayUnit = fromBaseUnit(requirement.midpointBase, displayUnit);
        if (!Number.isFinite(readingInDisplayUnit)) {
            return null;
        }

        const result = Math.abs(readingInDisplayUnit) * percent / 100;
        return buildCalculatedMpeResult(
            result,
            displayUnit,
            `±${formatNumber(Math.abs(readingInDisplayUnit))} × ${formatNumber(percent)}% = ${formatNumber(result)} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, displayUnit))}`,
            requirement
        );
    }

    if (/^±?-?\d+(?:\.\d+)?%$/i.test(formula)) {
        const percent = extractPercent(formula);
        const displayUnit = requirement.unit;
        const readingInDisplayUnit = fromBaseUnit(requirement.midpointBase, displayUnit);
        if (!Number.isFinite(percent) || !Number.isFinite(readingInDisplayUnit)) {
            return null;
        }

        const result = Math.abs(readingInDisplayUnit) * percent / 100;
        return buildCalculatedMpeResult(
            result,
            displayUnit,
            `±${formatNumber(Math.abs(readingInDisplayUnit))} × ${formatNumber(percent)}% = ${formatNumber(result)} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, displayUnit))}`,
            requirement
        );
    }

    return null;
}

/**
 * 解析温度类设备常见的 MPE 公式。
 *
 * 当前支持常数加 |t| 项，以及系数乘 t 的规则。
 */
function calculateTemperatureMpe(formula, requirement) {
    const absTFormula = formula.match(/\(?(-?\d+(?:\.\d+)?)\+(-?\d+(?:\.\d+)?)\*\|?t\|?\)?/i);
    if (absTFormula) {
        const constant = Number(absTFormula[1]);
        const coefficient = Number(absTFormula[2]);
        const tValue = Math.abs(requirement.midpoint);
        const result = constant + coefficient * tValue;
        return buildCalculatedMpeResult(
            result,
            requirement.unit || '℃',
            `±(${formatNumber(constant)} + ${formatNumber(coefficient)} × ${formatNumber(tValue)}) = ${formatNumber(result)} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, requirement.unit || '℃'))}`,
            requirement
        );
    }

    const tFormula = formula.match(/(-?\d+(?:\.\d+)?)\*t/i);
    if (tFormula) {
        const coefficient = Number(tFormula[1]);
        const tValue = requirement.midpoint;
        const result = Math.abs(coefficient * tValue);
        return buildCalculatedMpeResult(
            result,
            requirement.unit || '℃',
            `±${formatNumber(coefficient)} × ${formatNumber(tValue)} = ${formatNumber(result)} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, requirement.unit || '℃'))}`,
            requirement
        );
    }

    return null;
}

/**
 * 解析力学类中“X 级”对应的满量程百分比误差。
 */
function calculateMechanicalClassMpe(formula, requirement, deviceRange) {
    const classLevelMatch = formula.match(/(-?\d+(?:\.\d+)?)级/);
    if (!classLevelMatch) {
        return null;
    }

    const level = Number(classLevelMatch[1]);
    const displayUnit = requirement.unit || deviceRange.unit;
    const fullScaleInDisplayUnit = fromBaseUnit(deviceRange.maxBase, displayUnit);
    if (!Number.isFinite(fullScaleInDisplayUnit)) {
        return null;
    }

    const result = Math.abs(fullScaleInDisplayUnit) * level / 100;
    return buildCalculatedMpeResult(
        result,
        displayUnit,
        `${formatNumber(Math.abs(fullScaleInDisplayUnit))} × ${formatNumber(level)}% = ${formatNumber(result)} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, displayUnit))}`,
        requirement
    );
}

/**
 * 解析 II / III 级天平等分级规则。
 *
 * 这类规则不是简单百分比，而是按质量区间对应固定 MPE，需要单独分段判断。
 */
function calculateMechanicalScaleClass(formula, requirement) {
    if (!/^(II|III)$/i.test(formula)) {
        return null;
    }

    const midValueBase = requirement.midpointBase;
    const displayUnit = requirement.unit || 'g';
    const className = formula.toUpperCase();
    let resultInGram = null;
    const mInGram = fromBaseUnit(midValueBase, 'g');
    if (!Number.isFinite(mInGram)) {
        return null;
    }

    if (className === 'III') {
        if (mInGram >= 2 && mInGram <= 50) {
            resultInGram = 0.05;
        } else if (mInGram > 50 && mInGram <= 200) {
            resultInGram = 0.1;
        } else if (mInGram > 200 && mInGram <= 500) {
            resultInGram = 0.15;
        }
    }

    if (className === 'II') {
        if (mInGram >= 0.2 && mInGram <= 50) {
            resultInGram = 0.005;
        } else if (mInGram > 50 && mInGram <= 200) {
            resultInGram = 0.01;
        } else if (mInGram > 200 && mInGram <= 1020) {
            resultInGram = 0.015;
        }
    }

    if (!Number.isFinite(resultInGram)) {
        return null;
    }

    const resultInDisplayUnit = fromBaseUnit(toBaseUnit(resultInGram, 'g'), displayUnit);
    return buildCalculatedMpeResult(
        resultInDisplayUnit,
        displayUnit,
        `${className}级分段判定：m = ${formatNumber(mInGram)} g，MPE = ${formatNumber(resultInGram)} g ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, displayUnit))}`,
        requirement
    );
}

/**
 * 解析长度类按测量点 L 分段给出 MPE 的规则。
 *
 * 例如：0＜L≤70时：±0.02；70＜L≤200时：±0.03。
 * 这里的测量点取用户区间的中间值，并且按逐行规则匹配，避免把下一行开头数字拼到当前行。
 */
function calculateLengthSegmentedMpe(formula, requirement) {
    if (!formula || !/[Ll]/.test(formula) || !/(?:≤|<=|＜|<)/.test(formula)) {
        return null;
    }

    const displayUnit = requirement.unit || '';
    const measurementPoint = fromBaseUnit(requirement.midpointBase, displayUnit);
    if (!Number.isFinite(measurementPoint)) {
        return null;
    }

    const normalizedLines = String(formula)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/；/g, '\n')
        .replace(/;/g, '\n')
        .split(/\r?\n/)
        .map(line => line
            .replace(/（/g, '(')
            .replace(/）/g, ')')
            .replace(/＜/g, '<')
            .replace(/≤/g, '<=')
            .replace(/：/g, ':')
            .trim())
        .filter(Boolean);

    const segmentPattern = /(?:当)?\s*(-?\d+(?:\.\d+)?)\s*<\s*[Ll]\s*<=\s*(-?\d+(?:\.\d+)?)\s*(?:时)?\s*(?::)?\s*(?:MPE=)?\s*(?:±)?\s*(-?\d+(?:\.\d+)?)([a-zA-ZμμΩ℃°]+)?/i;

    for (const line of normalizedLines) {
        const match = line.match(segmentPattern);
        if (!match) {
            continue;
        }

        const lowerBound = Number(match[1]);
        const upperBound = Number(match[2]);
        const mpeValue = Math.abs(Number(match[3]));
        const mpeUnit = normalizeDisplayUnit(match[4] || displayUnit);

        if (!Number.isFinite(lowerBound) || !Number.isFinite(upperBound) || !Number.isFinite(mpeValue)) {
            continue;
        }

        if (measurementPoint > lowerBound && measurementPoint <= upperBound) {
            const renderedUnit = mpeUnit || displayUnit;
            return buildCalculatedMpeResult(
                mpeValue,
                renderedUnit,
                `按测量点 L 分段判定：L = ${formatNumber(measurementPoint)}${displayUnit ? ' ' + displayUnit : ''}，命中区间 (${formatNumber(lowerBound)}, ${formatNumber(upperBound)}]，MPE = ${formatNumber(mpeValue)}${renderedUnit ? ' ' + renderedUnit : ''} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, renderedUnit || displayUnit || ''))}`,
                requirement
            );
        }
    }

    return null;
}

/**
 * 解析“百分比满量程”公式，例如 0.05%FS。
 */
function calculateFullScalePercent(formula, requirement, deviceRange) {
    const match = formula.match(/(-?\d+(?:\.\d+)?)%FS/i);
    if (!match) {
        return null;
    }

    const percent = Number(match[1]);
    const displayUnit = requirement.unit || deviceRange.unit;
    const fullScaleInDisplayUnit = fromBaseUnit(deviceRange.maxBase, displayUnit);
    if (!Number.isFinite(fullScaleInDisplayUnit)) {
        return null;
    }

    const result = Math.abs(fullScaleInDisplayUnit) * percent / 100;
    return buildCalculatedMpeResult(
        result,
        displayUnit,
        `${formatNumber(Math.abs(fullScaleInDisplayUnit))} × ${formatNumber(percent)}% = ${formatNumber(result)} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, displayUnit))}`,
        requirement
    );
}

/**
 * 解析直接给出固定误差值的公式。
 *
 * 例如：±0.02mm。
 */
function calculateDirectNumericMpe(formula, requirement) {
    const match = formula.match(/±?(-?\d+(?:\.\d+)?)([a-zA-ZμμΩ℃°]+)?/);
    if (!match) {
        return null;
    }

    const value = Math.abs(Number(match[1]));
    if (!Number.isFinite(value)) {
        return null;
    }

    const formulaUnit = normalizeDisplayUnit(match[2] || requirement.unit || '');
    return buildCalculatedMpeResult(
        value,
        formulaUnit,
        `${formatNumber(value)}${formulaUnit ? ' ' + formulaUnit : ''} ≤ ${formatNumber(fromBaseUnit(requirement.mpeLimitBase, formulaUnit || requirement.unit || ''))}`,
        requirement
    );
}

/**
 * 根据设备类别和 MPE 原始文本选择合适的公式解析器。
 *
 * 这个函数相当于“规则分发中心”：
 * 1. 先根据一级分类挂载类别特有规则。
 * 2. 再尝试通用规则。
 * 3. 返回第一个成功解析出的 MPE 结果。
 */
function calculateDeviceMpe(record, requirement, deviceRange) {
    const rawFormula = record && record.fields ? record.fields.MPE : '';
    const formula = normalizeFormulaText(rawFormula);
    const category = record && record.fields && record.fields.一级分类 ? record.fields.一级分类.name : '';

    if (!formula) {
        return null;
    }

    const resolvers = [];
    if (category === '温度类') {
        resolvers.push(() => calculateTemperatureMpe(formula, requirement));
    }
    if (category === '力学类') {
        resolvers.push(() => calculateMechanicalScaleClass(formula, requirement));
        resolvers.push(() => calculateMechanicalClassMpe(formula, requirement, deviceRange));
    }
    if (category === '长度类') {
        resolvers.push(() => calculateLengthSegmentedMpe(rawFormula, requirement));
    }

    resolvers.push(() => calculateByReadingPlusFullScalePercent(formula, requirement, deviceRange));
    resolvers.push(() => calculateByReadingPlusConstant(formula, requirement));
    resolvers.push(() => calculateFullScalePercent(formula, requirement, deviceRange));
    resolvers.push(() => calculateByPercentOfReading(formula, requirement));
    resolvers.push(() => calculateDirectNumericMpe(formula, requirement));

    for (const resolve of resolvers) {
        const result = resolve();
        if (result) {
            return {
                ...result,
                rawFormula: rawFormula || '无'
            };
        }
    }

    return null;
}

/**
 * 以适合页面展示的方式格式化数字。
 *
 * 这里统一保留到最多 6 位小数，并去掉多余尾零。
 */
function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return '无';
    }
    return Number(value.toFixed(6)).toString();
}

/**
 * 把测量区间对象格式化成可读文本。
 */
function formatRange(requirement) {
    if (!requirement) {
        return '无';
    }

    const unitSuffix = requirement.unit ? ` ${requirement.unit}` : '';
    if (requirement.inputFormat === 'plus-minus') {
        return `${formatNumber(requirement.midpoint)}±${formatNumber(requirement.tolerance)}${unitSuffix}`;
    }

    return `(${formatNumber(requirement.min)}-${formatNumber(requirement.max)})${unitSuffix}`;
}

/**
 * 按“设备名称 + 型号”合并记录，并聚合厂家。
 *
 * 同一型号可能有多个厂家，页面希望把它们展示在同一张卡片中，减少重复条目。
 */
function mergeRecordsByEquipmentAndModel(records) {
    const merged = {};

    records.forEach(record => {
        const key = `${record.fields.名称}_${record.fields.型号}`;
        if (!merged[key]) {
            merged[key] = {
                ...record,
                fields: {
                    ...record.fields,
                    生产厂家: [record.fields.生产厂家]
                }
            };
        } else if (!merged[key].fields.生产厂家.includes(record.fields.生产厂家)) {
            merged[key].fields.生产厂家.push(record.fields.生产厂家);
        }
    });

    return Object.values(merged).map(record => ({
        ...record,
        fields: {
            ...record.fields,
            生产厂家: record.fields.生产厂家.join('、')
        }
    }));
}

/**
 * 渲染结果区并切换页面视图。
 *
 * 提交后会隐藏表单、显示结果卡片；若没有结果则展示对应模式下的空状态说明。
 */
function displayResults(formData, records) {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '';

    const requirement = formData.measurement_requirement_parsed;
    const summaryCard = document.createElement('div');
    summaryCard.className = `result-summary ${requirement ? 'measurement-mode' : 'browse-mode'}`;
    summaryCard.innerHTML = requirement
        ? buildMeasurementSummary(requirement)
        : buildBrowseSummary(formData, records.length);
    resultsList.appendChild(summaryCard);

    if (records.length === 0) {
        const noResult = document.createElement('div');
        noResult.className = 'result-card';
        noResult.innerHTML = requirement
            ? '<h3>无匹配结果</h3><p>没有找到同时满足量程覆盖和 MPE 判定规则的设备记录。</p>'
            : '<h3>无匹配结果</h3><p>没有找到符合当前筛选条件的设备记录。</p>';
        resultsList.appendChild(noResult);
    } else {
        records.forEach((record, index) => {
            resultsList.appendChild(createResultCard(formData, record, index + 1));
        });
    }

    document.getElementById('formContainer').style.display = 'none';
    document.getElementById('resultContainer').style.display = 'block';
}

/**
 * 生成技术筛选模式下的结果摘要卡片 HTML。
 */
function buildMeasurementSummary(requirement) {
    const unitSuffix = requirement && requirement.unit ? ` ${requirement.unit}` : '';
    return `
        <div class="summary-topline">
            <div class="summary-title">技术筛选结果</div>
            <span class="mode-badge measurement">已启用 MPE 与量程判定</span>
        </div>
        <div class="summary-grid">
            <div class="summary-item"><strong>测量对象要求范围</strong><span>${formatRange(requirement)}</span></div>
            <div class="summary-item"><strong>本次判定上限</strong><span>${formatNumber(requirement.intervalLength)} ÷ 6 = ${formatNumber(requirement.mpeLimit)}${unitSuffix}</span></div>
            <div class="summary-item"><strong>技术原则</strong><span>设备计算 MPE 必须小于等于测量对象区间长度 ÷ 6。</span></div>
            <div class="summary-item"><strong>量程原则</strong><span>器具量程必须完整覆盖测量对象要求范围。</span></div>
            <div class="summary-item"><strong>MPE 计算方式</strong><span>根据设备类别和 MPE 字段内容自动匹配公式。</span></div>
            <div class="summary-item"><strong>排序方式</strong><span>按设备 MPE 从大到小排序。</span></div>
        </div>
    `;
}

/**
 * 生成普通条件查询模式下的结果摘要卡片 HTML。
 */
function buildBrowseSummary(formData, total) {
    const conditions = [
        ['类别', formData.category],
        ['二级分类', formData.sub_category],
        ['设备名称', formData.equipment_name],
        ['型号', formData.model],
        ['厂家', formData.manufacturer],
        ['关键字', formData.keyword]
    ]
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}: ${value}`);

    return `
        <div class="summary-topline">
            <div class="summary-title">条件查询结果</div>
            <span class="mode-badge browse">未启用技术筛选</span>
        </div>
        <div class="summary-grid">
            <div class="summary-item"><strong>查询模式</strong><span>仅按表单条件查询，不执行量程与 MPE 计算。</span></div>
            <div class="summary-item"><strong>测量对象要求范围</strong><span>未填写</span></div>
            <div class="summary-item"><strong>筛选条件</strong><span>${conditions.length > 0 ? conditions.join('；') : '未填写任何条件，当前展示全部工具。'}</span></div>
            <div class="summary-item"><strong>结果数量</strong><span>${total}</span></div>
            <div class="summary-item"><strong>排序方式</strong><span>按类别、二级分类、名称、型号排序展示。</span></div>
        </div>
    `;
}

/**
 * 为单条设备记录创建结果卡片。
 *
 * 卡片会根据是否启用技术筛选，决定展示原始误差信息还是计算后的 MPE 结果。
 */
function createResultCard(formData, record, index) {
    let rangeText = '';
    if (record && record.fields.测量下限 && record.fields.测量上限) {
        rangeText = `${record.fields.测量下限}-${record.fields.测量上限}`;
    }

    const requirement = formData.measurement_requirement_parsed;
    const rawFields = record && record.fields ? (record.fields.原始字段 || {}) : {};
    const unitSuffix = requirement && requirement.unit ? ` ${requirement.unit}` : '';
    const browseMode = !requirement;
    const mpeText = record && record.computedMpe ? record.computedMpe.displayValue : (record.fields.MPE || '无');
    const rawMpevText = rawFields.MPEV
        ? String(rawFields.MPEV).replace(/\r?\n/g, '<br>')
        : '无';
    const mpeExpression = record && record.computedMpe ? record.computedMpe.expression : '未输入测量对象要求范围，未执行 MPE 适配计算';
    const measurementRequirementText = requirement ? formatRange(requirement) : '未填写';
    const measurementLimitText = requirement ? `${formatNumber(requirement.mpeLimit)}${unitSuffix}` : '未计算';

    const card = document.createElement('div');
    card.className = `result-card ${browseMode ? 'browse-mode' : 'measurement-mode'}`;
    card.innerHTML = `
        <div class="result-card-header">
            <h3>选型 ${index}: ${record.fields.名称}</h3>
            <span class="mode-badge ${browseMode ? 'browse' : 'measurement'}">${browseMode ? '条件查询' : '技术筛选'}</span>
        </div>
        <table class="result-table">
            <tr>
                <th style="width: 42%;">项目</th>
                <th>参数</th>
            </tr>
            <tr>
                <td>器具量程范围</td>
                <td>${rangeText || '无'}</td>
            </tr>
            <tr>
                <td>测量对象要求范围</td>
                <td>${measurementRequirementText}</td>
            </tr>
            <tr>
                <td>${browseMode ? '设备最大误差/准确度' : '设备最大误差 (MPEV)'}</td>
                <td>${mpeText}</td>
            </tr>
            <tr>
                <td>MPE计算举例</td>
                <td>${rawMpevText}</td>
            </tr>
            <tr>
                <td>${browseMode ? '说明' : 'MPEV 计算过程'}</td>
                <td>${mpeExpression}</td>
            </tr>
            <tr>
                <td>${browseMode ? '查询模式' : '允许 MPEV 上限'}</td>
                <td>${browseMode ? '按条件查询，未做量程和 MPE 过滤' : measurementLimitText}</td>
            </tr>
            <tr>
                <td>二级分类</td>
                <td>${record.fields.二级分类 || '无'}</td>
            </tr>
            <tr>
                <td>型号</td>
                <td>${record.fields.型号 || '无'}</td>
            </tr>
            <tr>
                <td>生产厂家</td>
                <td>${record.fields.生产厂家 || '无'}</td>
            </tr>
        </table>
        <div class="application-scenario">
            <h3>应用场景：</h3>
            <p>${record.fields.应用场景 || '无'}</p>
        </div>
        <div class="image-display">
            <h3>图片展示：</h3>
            <div>${record.fields.图片 && record.fields.图片.length > 0 ? `<img src="${record.fields.图片[0].url}" alt="设备图片">` : '无图片'}</div>
        </div>
    `;

    return card;
}

/**
 * 从结果页返回到查询表单。
 */
function backToForm() {
    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('formContainer').style.display = 'block';
}

window.backToForm = backToForm;