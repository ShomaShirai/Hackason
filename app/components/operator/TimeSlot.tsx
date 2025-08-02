import { useDroppable } from '@dnd-kit/core'

interface Assignment {
  appointmentId: number
  patientName: string
  chiefComplaint: string
  status: string
  duration: number
}

interface TimeSlotProps {
  doctorId: number
  time: string
  assignment?: Assignment
  isOver?: boolean
}

export function TimeSlot({ doctorId, time, assignment, isOver }: TimeSlotProps) {
  const { setNodeRef } = useDroppable({
    id: `slot-${doctorId}-${time}`,
    data: { doctorId, time },
  })

  const getStatusColor = (status?: string) => {
    if (!status) {return ''}
    switch (status) {
      case 'assigned':
        return 'bg-blue-100 border-blue-300'
      case 'in_progress':
        return 'bg-purple-100 border-purple-300'
      case 'completed':
        return 'bg-gray-100 border-gray-300'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        h-20 border rounded-md p-2 transition-all
        ${assignment ? getStatusColor(assignment.status) : 'bg-white border-gray-200'}
        ${isOver ? 'bg-green-50 border-green-400 border-2' : ''}
        ${!assignment && !isOver ? 'hover:bg-gray-50' : ''}
      `}
    >
      {assignment ? (
        <div className="h-full flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-900 truncate">
              {assignment.patientName}
            </p>
            <p className="text-xs text-gray-600 truncate">
              {assignment.chiefComplaint}
            </p>
          </div>
          <p className="text-xs text-gray-500">
            {assignment.duration}分
          </p>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-xs text-gray-400">空き</p>
        </div>
      )}
    </div>
  )
}