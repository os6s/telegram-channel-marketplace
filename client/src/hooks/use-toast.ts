// use-toast.ts
import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

// 1. تعديل الإعدادات الزمنية
const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 3000 // 3 ثواني بدلاً من 1,000,000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// 2. إضافة registry لتتبع الإشعارات النشطة
const activeToasts = new Set<string>()

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

// 3. تحسين إنشاء الـ ID ليكون أكثر تحديداً
function genId(title?: React.ReactNode): string {
  if (typeof title === 'string') {
    return title.toLowerCase().replace(/\s+/g, '-')
  }
  return Date.now().toString()
}

// ... (بقية أنواع Action و State تبقى كما هي)

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId) || activeToasts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    activeToasts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

// 4. تعديل الـ reducer لإدارة الإشعارات النشطة
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      if (activeToasts.has(action.toast.id)) {
        return state
      }
      activeToasts.add(action.toast.id)
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? { ...t, open: false }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        activeToasts.clear()
        return { toasts: [] }
      }
      activeToasts.delete(action.toastId)
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// ... (بقية الكود يبقى كما هو حتى جزء toast function)

// 5. تعديل دالة toast الأساسية
function toast({ ...props }: Toast) {
  // إنشاء ID بناءً على عنوان الإشعار إن أمكن
  const id = props.title ? genId(props.title) : genId()

  // إذا كان الإشعار موجوداً بالفعل، نقوم بتحديثه بدلاً من إضافة جديد
  if (activeToasts.has(id)) {
    return {
      id,
      dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }),
      update: (props: ToasterToast) =>
        dispatch({
          type: "UPDATE_TOAST",
          toast: { ...props, id },
        }),
    }
  }

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

// 6. تحسين useToast
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }