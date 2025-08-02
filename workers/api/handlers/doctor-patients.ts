import { Hono } from 'hono';
import { DrizzleRepositoryFactory } from '../../repositories';

const doctorPatientHandlers = new Hono();

doctorPatientHandlers.get('/', async (c: any) => {
    const user = c.get('user');
    const repoFactory = new DrizzleRepositoryFactory(c.env.DB);
    const patientRepo = repoFactory.createPatientRepository();

    const patients = await patientRepo.getPatientsByDoctorId(user.id);

    return c.json({ patients });
});

doctorPatientHandlers.get('/:id', async (c: any) => {
    const user = c.get('user');
    const patientId = parseInt(c.req.param('id'), 10);
    const repoFactory = new DrizzleRepositoryFactory(c.env.DB);
    const patientRepo = repoFactory.createPatientRepository();

    const patient = await patientRepo.getPatientByIdAndDoctorId(patientId, user.id);

    if (!patient) {
        return c.json({ error: 'Patient not found or not assigned to this doctor' }, 404);
    }

    return c.json({ patient });
});

export default doctorPatientHandlers;
