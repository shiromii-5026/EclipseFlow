/**
 * 回归测试：新建任务面板里"拖拽图片到识别框"必须真正触发 OCR 上传。
 * 曾经的 bug：.ocr-drop-zone 只有 @click / @change，没有任何 @drop 监听，
 * 拖进去的图片直接走浏览器默认行为（打开图片），永远不会上传。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import MainView from '../MainView.vue'

// jsdom 没有 matchMedia，而 ui store 在 setup 时就会调用
function stubMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response
}

/** jsdom 没有 DataTransfer，手动造一个最小可用对象 */
function fakeDataTransfer(files: File[]) {
  return { files, items: files.map((f) => ({ kind: 'file', type: f.type })), types: ['Files'] }
}

function dispatchWithDataTransfer(el: Element, type: string, dataTransfer: unknown) {
  const evt = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(evt, 'dataTransfer', { value: dataTransfer })
  el.dispatchEvent(evt)
}

function ocrFetchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((c) => String(c[0]).includes('/ocr-vision'))
}

let fetchMock: ReturnType<typeof vi.fn>
let wrapper: VueWrapper | null = null

beforeEach(() => {
  stubMatchMedia()
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/ocr-vision')) {
      return jsonResponse({ tasks: [{ taskName: '周会', startTime: '14:30:00' }] })
    }
    if (url.includes('/tasks/list')) return jsonResponse({ data: [] })
    return jsonResponse([])
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  wrapper?.unmount() // MainView 的 onUnmounted 里会 stopPolling
  wrapper = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('新建任务 · 拖拽图片识别', () => {
  it('把图片拖到识别框上会调用 /ocr-vision 上传并回填表单', async () => {
    wrapper = mount(MainView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const zone = wrapper.find('.ocr-drop-zone')
    expect(zone.exists()).toBe(true)

    const file = new File(['fake-image'], 'schedule.png', { type: 'image/png' })
    dispatchWithDataTransfer(zone.element, 'drop', fakeDataTransfer([file]))
    await flushPromises()

    const calls = ocrFetchCalls(fetchMock)
    expect(calls, '拖拽后应当发起 OCR 上传请求').toHaveLength(1)

    const body = calls[0]![1]?.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('file')).toBe(file)

    // 识别结果要回填到表单
    expect(zone.find('.ocr-status').text()).toBe('识别成功')
    expect((wrapper.vm as unknown as { newTask: { name: string } }).newTask.name).toBe('周会')
  })

  it('拖动过程中会 preventDefault，避免浏览器直接打开图片', async () => {
    wrapper = mount(MainView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const zone = wrapper.find('.ocr-drop-zone')
    const file = new File(['fake-image'], 'schedule.png', { type: 'image/png' })
    const evt = new Event('dragover', { bubbles: true, cancelable: true })
    Object.defineProperty(evt, 'dataTransfer', { value: fakeDataTransfer([file]) })
    zone.element.dispatchEvent(evt)

    expect(evt.defaultPrevented, 'dragover 必须 preventDefault 才能成为合法的放置目标').toBe(true)
  })

  it('拖入非图片文件时不发请求，并给出提示', async () => {
    wrapper = mount(MainView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    const zone = wrapper.find('.ocr-drop-zone')
    const file = new File(['plain'], 'note.txt', { type: 'text/plain' })
    dispatchWithDataTransfer(zone.element, 'drop', fakeDataTransfer([file]))
    await flushPromises()

    expect(ocrFetchCalls(fetchMock)).toHaveLength(0)
    expect(zone.find('.ocr-status').text()).toBe('')
  })
})
