import { computed, reactive, toRefs } from "vue";

/**
 * Offset/page/total/loading/error state machine for a server-paginated list.
 * @param {(params: { limit: number, offset: number }) => Promise<{ items: any[], total: number }>} fetchPage
 * @param {{ pageSize?: number }} [options]
 * @returns {{
 *   items: import("vue").Ref<any[]>,
 *   total: import("vue").Ref<number>,
 *   page: import("vue").Ref<number>,
 *   loading: import("vue").Ref<boolean>,
 *   error: import("vue").Ref<string>,
 *   pageSize: number,
 *   totalPages: import("vue").ComputedRef<number>,
 *   load: (page?: number) => Promise<void>,
 * }}
 */
export function usePaginatedResource(fetchPage, { pageSize = 25 } = {}) {
  const state = reactive({
    items: [],
    total: 0,
    page: 1,
    loading: true,
    error: "",
  });

  /**
   * @param {number} [page]
   * @returns {Promise<void>}
   */
  async function load(page = state.page) {
    state.loading = true;
    state.error = "";
    try {
      const offset = (page - 1) * pageSize;
      const { items, total } = await fetchPage({ limit: pageSize, offset });
      state.items = items;
      state.total = total;
      state.page = page;
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to load";
    } finally {
      state.loading = false;
    }
  }

  const totalPages = computed(() => Math.max(1, Math.ceil(state.total / pageSize)));

  return { ...toRefs(state), pageSize, totalPages, load };
}
