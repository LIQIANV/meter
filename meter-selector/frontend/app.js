const state = {
    options: null,
    allRecords: [],
    cascadeData: {},
    searchLogs: []
};

const API_BASE = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:8000/api'
    : '/api';

const categorySelect = document.getElementById('category');
const subCategorySelect = document.getElementById('sub_category');
const equipmentNameSelect = document.getElementById('equipment_name');
const modelSelect = document.getElementById('model');
const manufacturerSelect = document.getElementById('manufacturer');
const measurementRequirementInput = document.getElementById('measurement_requirement');
const keywordInput = document.getElementById('keyword');
const messageBar = document.getElementById('messageBar');
const openHistoryBtn = document.getElementById('openHistoryBtn');
const openHistoryBtnResult = document.getElementById('openHistoryBtnResult');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const historyBackdrop = document.getElementById('historyBackdrop');
const historyModal = document.getElementById('historyModal');
const historyList = document.getElementById('historyList');

document.getElementById('measurementForm').addEventListener('submit', handleSubmit);
categorySelect.addEventListener('change', handleCategoryChange);
subCategorySelect.addEventListener('change', handleSubCategoryChange);
equipmentNameSelect.addEventListener('change', handleEquipmentChange);
modelSelect.addEventListener('change', handleModelChange);
openHistoryBtn.addEventListener('click', openHistoryModal);
openHistoryBtnResult.addEventListener('click', openHistoryModal);
closeHistoryBtn.addEventListener('click', closeHistoryModal);
historyBackdrop.addEventListener('click', closeHistoryModal);

window.addEventListener('DOMContentLoaded', initializePage);

async function initializePage() {
    try {
        setMessage('正在加载筛选数据...', 'info');
        const [optionsResult, recordsResult, logsResult] = await Promise.all([
            fetchJson(buildApiUrl('/options')),
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

        state.options = optionsResult.data;
        state.allRecords = transformRecords(recordsResult.data.records);
        state.cascadeData = generateCascadeData(state.allRecords);
        state.searchLogs = logsResult.data.records || [];
        renderHistoryList();

        populateSelect(categorySelect, state.options.categories, '请选择类别');
        resetSelect(subCategorySelect, '请先选择类别');
        resetSelect(equipmentNameSelect, '请先选择二级分类');
        resetSelect(modelSelect, '请先选择设备名称');
        resetSelect(manufacturerSelect, '请先选择型号');

        if (state.allRecords.length === 0) {
            setMessage('当前本地数据为空，请先执行同步脚本。', 'info');
            return;
        }

        clearMessage();
    } catch (error) {
        setMessage(error.message || '加载初始数据失败，请确认后端服务已经启动。', 'error');
    }
}

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

async function handleSubmit(event) {
    event.preventDefault();

    const requirementText = measurementRequirementInput.value.trim();
    const measurementRequirement = requirementText ? parseMeasurementRequirement(requirementText) : null;
    if (requirementText && !measurementRequirement) {
        setMessage('测量对象要求范围格式无效，请输入类似 (5.4-5.7)mm 或 （10~12）mm 的区间。', 'error');
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

async function refreshSearchLogs() {
    const logsResult = await fetchJson(buildApiUrl('/search-logs?limit=12'));
    state.searchLogs = logsResult.data.records || [];
    renderHistoryList();
}

function sortRecordsForBrowse(left, right) {
    const leftText = `${left.fields.一级分类.name}|${left.fields.二级分类}|${left.fields.名称}|${left.fields.型号}`;
    const rightText = `${right.fields.一级分类.name}|${right.fields.二级分类}|${right.fields.名称}|${right.fields.型号}`;
    return leftText.localeCompare(rightText, 'zh-CN');
}

function buildApiUrl(path) {
    return `${API_BASE}${path}`;
}

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

function setMessage(message, type) {
    messageBar.textContent = message;
    messageBar.className = `message-bar ${type}`;
}

function openHistoryModal() {
    renderHistoryList();
    historyModal.classList.remove('hidden');
}

function closeHistoryModal() {
    historyModal.classList.add('hidden');
}

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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clearMessage() {
    messageBar.textContent = '';
    messageBar.className = 'message-bar hidden';
}

function populateSelect(selectElement, items, placeholder) {
    resetSelect(selectElement, placeholder);
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        selectElement.appendChild(option);
    });
}

function resetSelect(selectElement, placeholder) {
    selectElement.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    selectElement.appendChild(option);
}

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

    const match = normalized.match(/\(?(-?\d+(?:\.\d+)?)\s*[-~]\s*(-?\d+(?:\.\d+)?)\)?([a-z%μμ\u4e00-\u9fa5]*)?/i);
    if (!match) {
        return null;
    }

    const firstValue = Number(match[1]);
    const secondValue = Number(match[2]);
    if (!Number.isFinite(firstValue) || !Number.isFinite(secondValue) || secondValue <= firstValue) {
        return null;
    }

    const rawUnit = (match[3] || '').trim();
    const unit = normalizeDisplayUnit(rawUnit || inferUnitFromRange(input));
    const unitMeta = getUnitMeta(unit);
    const intervalLength = secondValue - firstValue;
    const midpoint = (firstValue + secondValue) / 2;
    const minBase = toBaseUnit(firstValue, unit);
    const maxBase = toBaseUnit(secondValue, unit);
    const intervalLengthBase = maxBase - minBase;

    return {
        min: firstValue,
        max: secondValue,
        unit,
        dimension: unitMeta.dimension,
        intervalLength,
        midpoint,
        absMidpoint: Math.abs(midpoint),
        minBase,
        maxBase,
        midpointBase: toBaseUnit(midpoint, unit),
        absMidpointBase: Math.abs(toBaseUnit(midpoint, unit)),
        intervalLengthBase,
        mpeLimit: intervalLength / 6,
        mpeLimitBase: intervalLengthBase / 6
    };
}

function inferUnitFromRange(input) {
    const unitMatch = input.match(/[a-zA-Z%μμΩ℃°\u4e00-\u9fa5]+\s*$/);
    return unitMatch ? unitMatch[0].trim() : '';
}

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

function getUnitKey(unit) {
    if (!unit) {
        return '';
    }
    return normalizeDisplayUnit(unit).toLowerCase();
}

function getUnitMeta(unit) {
    return UNIT_MAP[getUnitKey(unit)] || { factor: 1, dimension: 'generic', display: normalizeDisplayUnit(unit) };
}

function toBaseUnit(value, unit) {
    if (!Number.isFinite(value)) {
        return null;
    }
    const meta = getUnitMeta(unit);
    return value * meta.factor;
}

function fromBaseUnit(value, unit) {
    if (!Number.isFinite(value)) {
        return null;
    }
    const meta = getUnitMeta(unit);
    return meta.factor === 0 ? null : value / meta.factor;
}

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

function extractPercent(text) {
    const match = text.match(/(-?\d+(?:\.\d+)?)%/);
    return match ? Number(match[1]) : null;
}

function buildCalculatedMpeResult(value, displayUnit, expression, requirement) {
    if (!Number.isFinite(value)) {
        return null;
    }

    const resolvedUnit = normalizeDisplayUnit(displayUnit || requirement.unit || '');
    const normalizedValue = toBaseUnit(value, resolvedUnit);
    return {
        value,
        unit: resolvedUnit,
        normalizedValue,
        displayValue: `${formatNumber(value)}${resolvedUnit ? ' ' + resolvedUnit : ''}`,
        expression
    };
}

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

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return '无';
    }
    return Number(value.toFixed(6)).toString();
}

function formatRange(requirement) {
    if (!requirement) {
        return '无';
    }

    const unitSuffix = requirement.unit ? ` ${requirement.unit}` : '';
    return `(${formatNumber(requirement.min)}-${formatNumber(requirement.max)})${unitSuffix}`;
}

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

function createResultCard(formData, record, index) {
    let rangeText = '';
    if (record && record.fields.测量下限 && record.fields.测量上限) {
        rangeText = `${record.fields.测量下限}-${record.fields.测量上限}`;
    }

    const requirement = formData.measurement_requirement_parsed;
    const unitSuffix = requirement && requirement.unit ? ` ${requirement.unit}` : '';
    const browseMode = !requirement;
    const mpeText = record && record.computedMpe ? record.computedMpe.displayValue : (record.fields.MPE || '无');
    const mpeFormulaText = record && record.fields.MPE ? String(record.fields.MPE) : '无';
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
                <td>MPE 原始规则</td>
                <td>${mpeFormulaText}</td>
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

function backToForm() {
    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('formContainer').style.display = 'block';
}

window.backToForm = backToForm;