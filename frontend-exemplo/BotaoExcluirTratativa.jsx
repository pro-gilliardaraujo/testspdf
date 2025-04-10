import React, { useState } from 'react';
import axios from 'axios';
import { Button, Modal, Input, Form, message, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

/**
 * Componente de botão para exclusão de tratativa com confirmação
 * 
 * Props:
 * - tratativa: objeto com os dados da tratativa
 * - onTratativaExcluida: função a ser chamada quando uma tratativa for excluída com sucesso
 * - position: posição do botão (default, right, etc.)
 * - danger: se deve usar estilo de perigo (vermelho)
 */
const BotaoExcluirTratativa = ({ 
  tratativa, 
  onTratativaExcluida, 
  position = 'default',
  danger = true 
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [numeroDigitado, setNumeroDigitado] = useState('');
  const [form] = Form.useForm();
  
  const API_URL = 'https://iblogistica.ddns.net:3000/api/tratativa';
  
  // Abrir modal de confirmação
  const showModal = () => {
    setModalVisible(true);
    setNumeroDigitado('');
    form.resetFields();
  };
  
  // Fechar modal
  const handleCancel = () => {
    setModalVisible(false);
  };
  
  // Verificar se o número digitado corresponde ao número da tratativa
  const numeroConfere = () => {
    return numeroDigitado === tratativa.numero_tratativa;
  };
  
  // Executar exclusão
  const handleExcluir = async () => {
    if (!numeroConfere()) {
      message.error('O número digitado não corresponde ao número da tratativa.');
      return;
    }
    
    setConfirmLoading(true);
    
    try {
      const response = await axios.delete(`${API_URL}/delete/${tratativa.id}`);
      
      if (response.data.status === 'success') {
        message.success('Tratativa excluída com sucesso!');
        setModalVisible(false);
        
        // Notificar o componente pai
        if (onTratativaExcluida) {
          onTratativaExcluida(tratativa.id);
        }
      } else {
        message.error(`Erro ao excluir: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Erro ao excluir tratativa:', error);
      message.error(
        error.response?.data?.message || 
        'Erro de comunicação com o servidor'
      );
    } finally {
      setConfirmLoading(false);
    }
  };
  
  // Estilo para botão baseado na posição
  const getButtonStyle = () => {
    if (position === 'right') {
      return { marginLeft: '8px' };
    }
    return {};
  };
  
  return (
    <>
      <Button
        type={danger ? "primary" : "default"}
        danger={danger}
        icon={<DeleteOutlined />}
        size="small"
        onClick={showModal}
        title="Excluir tratativa"
        style={getButtonStyle()}
      >
        Excluir
      </Button>
      
      <Modal
        title={
          <div style={{ color: '#ff4d4f' }}>
            <DeleteOutlined /> Excluir Tratativa
          </div>
        }
        open={modalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="back" onClick={handleCancel}>
            Cancelar
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            danger 
            loading={confirmLoading}
            disabled={!numeroConfere()}
            onClick={handleExcluir}
          >
            Excluir
          </Button>
        ]}
      >
        <div style={{ marginBottom: '20px' }}>
          <p>
            Você está prestes a excluir permanentemente a tratativa:
          </p>
          <p style={{ fontWeight: 'bold' }}>
            Nº {tratativa.numero_tratativa} - {tratativa.funcionario} ({tratativa.setor})
          </p>
          <p>
            Esta ação não pode ser desfeita. Todos os dados da tratativa serão removidos, 
            incluindo documentos gerados.
          </p>
        </div>
        
        <Form form={form} layout="vertical">
          <Form.Item
            label="Digite o número da tratativa para confirmar a exclusão:"
            name="numeroTratativa"
            rules={[
              { 
                required: true, 
                message: 'Por favor, digite o número da tratativa para confirmar!' 
              },
              {
                validator: (_, value) => {
                  if (value && value !== tratativa.numero_tratativa) {
                    return Promise.reject('O número digitado não corresponde!');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input 
              placeholder={`Digite: ${tratativa.numero_tratativa}`}
              value={numeroDigitado}
              onChange={(e) => setNumeroDigitado(e.target.value)}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default BotaoExcluirTratativa; 