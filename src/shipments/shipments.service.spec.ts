import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentEntity } from './entities/shipment.entity';
import { ShipmentRulesService } from './shipment-rules.service';
import { ShipmentStatus } from './shipment-status.enum';
import { ShipmentsService } from './shipments.service';

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let repositoryMock: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let rulesMock: { ensureCanBeDispatched: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    repositoryMock = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    rulesMock = { ensureCanBeDispatched: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        {
          provide: getRepositoryToken(ShipmentEntity),
          useValue: repositoryMock,
        },
        { provide: ShipmentRulesService, useValue: rulesMock },
      ],
    }).compile();

    service = moduleRef.get(ShipmentsService);
  });

  it('is defined', () => {

    const instance = service;

    expect(instance).toBeDefined();
  });

  it('returns all shipments', async () => {

    const shipments: ShipmentEntity[] = [
      { id: 1, trackingCode: 'SHIP-001', destination: 'Cali', status: ShipmentStatus.CREATED },
      { id: 2, trackingCode: 'SHIP-002', destination: 'Bogota', status: ShipmentStatus.DISPATCHED },
    ];
    repositoryMock.find.mockResolvedValue(shipments);

    const result = await service.findAll();

    expect(result).toBe(shipments);
    expect(repositoryMock.find).toHaveBeenCalledTimes(1);
    expect(repositoryMock.find).toHaveBeenCalledWith();
  });

  it('returns a shipment when the id exists', async () => {

    const shipment: ShipmentEntity = {
      id: 7, trackingCode: 'SHIP-007', destination: 'Cali', status: ShipmentStatus.CREATED,
    };
    repositoryMock.findOneBy.mockResolvedValue(shipment);

    const result = await service.findOne(7);

    expect(result).toBe(shipment);
    expect(repositoryMock.findOneBy).toHaveBeenCalledTimes(1);
    expect(repositoryMock.findOneBy).toHaveBeenCalledWith({ id: 7 });
  });

  it('throws NotFoundException when the id does not exist', async () => {

    repositoryMock.findOneBy.mockResolvedValue(null);

    const result = service.findOne(999);

    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    expect(repositoryMock.findOneBy).toHaveBeenCalledWith({ id: 999 });
    expect(repositoryMock.save).not.toHaveBeenCalled();
  });

  it('creates and saves a shipment', async () => {

    const data: CreateShipmentDto = { trackingCode: 'SHIP-100', destination: 'Cali' };
    const entity = Object.assign(new ShipmentEntity(), data, { status: ShipmentStatus.CREATED });
    const savedShipment: ShipmentEntity = { ...entity, id: 100 };
    repositoryMock.create.mockReturnValue(entity);
    repositoryMock.save.mockResolvedValue(savedShipment);

    const result = await service.create(data);

    expect(repositoryMock.create).toHaveBeenCalledWith({ ...data, status: ShipmentStatus.CREATED });
    expect(repositoryMock.create).toHaveBeenCalledTimes(1);
    expect(repositoryMock.save).toHaveBeenCalledWith(entity);
    expect(repositoryMock.save).toHaveBeenCalledTimes(1);
    expect(result).toBe(savedShipment);
  });

  it('dispatches and saves a valid shipment', async () => {

    const shipment: ShipmentEntity = {
      id: 7, trackingCode: 'SHIP-007', destination: 'Cali', status: ShipmentStatus.CREATED,
    };
    const savedShipment: ShipmentEntity = { ...shipment, status: ShipmentStatus.DISPATCHED };
    repositoryMock.findOneBy.mockResolvedValue(shipment);
    repositoryMock.save.mockResolvedValue(savedShipment);
    let statusAtValidation: ShipmentStatus | undefined;
    rulesMock.ensureCanBeDispatched.mockImplementation((value: ShipmentEntity) => {
      statusAtValidation = value.status;
    });

    const result = await service.dispatch(7);

    expect(repositoryMock.findOneBy).toHaveBeenCalledWith({ id: 7 });
    expect(rulesMock.ensureCanBeDispatched).toHaveBeenCalledTimes(1);
    expect(rulesMock.ensureCanBeDispatched).toHaveBeenCalledWith(shipment);
    expect(statusAtValidation).toBe(ShipmentStatus.CREATED);
    expect(shipment.status).toBe(ShipmentStatus.DISPATCHED);
    expect(repositoryMock.save).toHaveBeenCalledTimes(1);
    expect(repositoryMock.save).toHaveBeenCalledWith(shipment);
    expect(rulesMock.ensureCanBeDispatched.mock.invocationCallOrder[0])
      .toBeLessThan(repositoryMock.save.mock.invocationCallOrder[0]);
    expect(result).toBe(savedShipment);
  });
});
