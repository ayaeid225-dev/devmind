package com.devmind.service;

import java.util.List;
import java.util.ArrayList;

public interface IService {
    boolean execute();
}

abstract class BaseEntity {
    public abstract String getId();
}

public class MainService extends BaseEntity implements IService {
    private String serviceId;

    public MainService(String serviceId) {
        this.serviceId = serviceId;
    }

    @Override
    public String getId() {
        return this.serviceId;
    }

    @Override
    public boolean execute() {
        return true;
    }

    public static void main(String[] args) {
        System.out.println("Java Service Started");
    }
}
