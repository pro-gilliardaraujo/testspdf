import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, message, Spin, Modal } from 'antd';
import { FileAddOutlined, ReloadOutlined } from '@ant-design/icons';

const TratativasSemDocumento = () => {
  const [tratativas, setTratativas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [currentTratativa, setCurrentTratativa] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const API_URL = 'https://iblogistica.ddns.net:3000/api/tratativa';

  // Função para carregar tratativas sem documento
  const carregarTratativas = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/list-without-pdf`);
      if (response.data.status === 'success') {
        setTratativas(response.data.data);
        message.success(`${response.data.count} tratativas sem documento encontradas`);
      } else {
        message.error('Erro ao carregar tratativas');
      }
    } catch (error) {
      console.error('Erro ao carregar tratativas:', error);
      message.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  // Carregar ao montar o componente
  useEffect(() => {
    carregarTratativas();
  }, []);

  // Função para regenerar um documento
  const regenerarDocumento = async (tratativa, folhaUnica = false) => {
    setRegenerating(true);
    setCurrentTratativa(tratativa);
    
    try {
      const response = await axios.post(`${API_URL}/regenerate-pdf`, {
        id: tratativa.id,
        folhaUnica: folhaUnica
      });
      
      if (response.data.status === 'success') {
        message.success(`Documento gerado com sucesso para ${tratativa.funcionario}`);
        // Recarregar a lista para remover a tratativa que teve o documento gerado
        carregarTratativas();
      } else if (response.data.status === 'info') {
        message.info(response.data.message);
      } else {
        message.error(`Erro ao gerar documento: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Erro ao regenerar documento:', error);
      message.error('Erro de comunicação com o servidor');
    } finally {
      setRegenerating(false);
      setModalVisible(false);
    }
  };

  // Abrir modal para confirmar regeneração
  const abrirModalRegeneracao = (tratativa) => {
    setCurrentTratativa(tratativa);
    setModalVisible(true);
  };

  // Colunas da tabela
  const columns = [
    {
      title: 'Número',
      dataIndex: 'numero_tratativa',
      key: 'numero_tratativa',
      sorter: (a, b) => a.numero_tratativa.localeCompare(b.numero_tratativa),
    },
    {
      title: 'Funcionário',
      dataIndex: 'funcionario',
      key: 'funcionario',
      sorter: (a, b) => a.funcionario.localeCompare(b.funcionario),
    },
    {
      title: 'Setor',
      dataIndex: 'setor',
      key: 'setor',
    },
    {
      title: 'Data',
      dataIndex: 'data_infracao',
      key: 'data_infracao',
      render: (text) => {
        if (!text) return '';
        const date = new Date(text);
        return date.toLocaleDateString('pt-BR');
      },
      sorter: (a, b) => new Date(a.data_infracao) - new Date(b.data_infracao),
    },
    {
      title: 'Código',
      dataIndex: 'codigo_infracao',
      key: 'codigo_infracao',
    },
    {
      title: 'Ações',
      key: 'acoes',
      render: (_, record) => (
        <Button 
          type="primary" 
          icon={<FileAddOutlined />} 
          onClick={() => abrirModalRegeneracao(record)}
          title="Gerar documento"
        >
          Gerar PDF
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <h2>Tratativas sem Documento Gerado</h2>
        <Button 
          type="default" 
          icon={<ReloadOutlined />} 
          onClick={carregarTratativas}
          loading={loading}
        >
          Atualizar
        </Button>
      </div>
      
      <Spin spinning={loading}>
        <Table 
          dataSource={tratativas} 
          columns={columns} 
          rowKey="id"
          pagination={{ pageSize:
          10 }}
          locale={{ emptyText: 'Nenhuma tratativa sem documento encontrada' }}
        />
      </Spin>
      
      <Modal
        title="Gerar Documento"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        {currentTratativa && (
          <div>
            <p>Como deseja gerar o documento para a tratativa <strong>{currentTratativa.numero_tratativa}</strong> do funcionário <strong>{currentTratativa.funcionario}</strong>?</p>
            
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
              <Button
                type="primary"
                loading={regenerating}
                onClick={() => regenerarDocumento(currentTratativa, false)}
              >
                Documento Completo (2 folhas)
              </Button>
              
              <Button
                type="default"
                loading={regenerating}
                onClick={() => regenerarDocumento(currentTratativa, true)}
              >
                Apenas Folha 1
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TratativasSemDocumento; 