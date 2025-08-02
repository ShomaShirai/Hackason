import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface PatientData {
  appointmentId: number
  patient: {
    id: number
    name: string
    age: number
  }
  chiefComplaint: string
  appointmentType: string
  priority: string
  requestedAt: string
  waitingTime?: number
}

interface DraggablePatientCardProps {
  patient: PatientData
  isDragging?: boolean
}

export function DraggablePatientCard({ patient, isDragging }: DraggablePatientCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `patient-${patient.appointmentId}`,
    data: patient,
  })

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
  } : undefined

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-400 bg-red-50'
      case 'medium':
        return 'border-yellow-400 bg-yellow-50'
      default:
        return 'border-blue-400 bg-blue-50'
    }
  }

  const getPriorityBadge = (priority: string) => {
    const priorityMap = {
      high: { text: '高', color: 'bg-red-100 text-red-800' },
      medium: { text: '中', color: 'bg-yellow-100 text-yellow-800' },
      normal: { text: '通常', color: 'bg-blue-100 text-blue-800' },
    }

    const { text, color } = priorityMap[priority as keyof typeof priorityMap] || {
      text: priority,
      color: 'bg-gray-100 text-gray-800',
    }

    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>{text}</span>
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        p-3 rounded-lg border-2 cursor-move transition-all
        ${getPriorityColor(patient.priority)}
        ${isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-gray-900">
            {patient.patient.name}様
          </h4>
          <p className="text-xs text-gray-600">
            {patient.patient.age}歳 | {patient.appointmentType === 'initial' ? '初診' : '再診'}
          </p>
        </div>
        {getPriorityBadge(patient.priority)}
      </div>
      
      <p className="text-xs text-gray-700 mb-1">
        主訴: {patient.chiefComplaint}
      </p>
      
      {patient.waitingTime && (
        <p className="text-xs text-gray-500">
          待機時間: {patient.waitingTime}分
        </p>
      )}
    </div>
  )
}